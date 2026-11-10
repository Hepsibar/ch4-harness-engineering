import { describe, it, expect } from "vitest";
import { parseChannelInput } from "@/lib/parseChannel";

describe("parseChannelInput", () => {
  it("@handle 형식 → handle (앞의 @ 제거)", () => {
    expect(parseChannelInput("@mychannel")).toEqual({ handle: "mychannel" });
  });

  it("youtube.com/@handle URL → handle", () => {
    expect(parseChannelInput("https://youtube.com/@mychannel")).toEqual({
      handle: "mychannel",
    });
    expect(
      parseChannelInput("https://www.youtube.com/@my.channel_1/videos"),
    ).toEqual({ handle: "my.channel_1" });
  });

  it("youtube.com/channel/UC... URL → channelId", () => {
    expect(
      parseChannelInput(
        "https://www.youtube.com/channel/UC1234567890123456789012",
      ),
    ).toEqual({ channelId: "UC1234567890123456789012" });
  });

  it("순수 채널 ID (UC + 22자) → channelId", () => {
    expect(parseChannelInput("UC1234567890123456789012")).toEqual({
      channelId: "UC1234567890123456789012",
    });
  });

  it("앞뒤 공백을 트림한다", () => {
    expect(parseChannelInput("  @spaced  ")).toEqual({ handle: "spaced" });
  });

  it("@ 없는 bare 문자열 → handle 로 간주", () => {
    expect(parseChannelInput("plainhandle")).toEqual({ handle: "plainhandle" });
  });

  it("빈 문자열/공백만 → null", () => {
    expect(parseChannelInput("")).toBeNull();
    expect(parseChannelInput("   ")).toBeNull();
  });

  it("핸들/채널을 식별할 수 없는 youtube URL → null", () => {
    expect(parseChannelInput("https://youtube.com/watch?v=abc123")).toBeNull();
  });
});
