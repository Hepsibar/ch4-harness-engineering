import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Video, ChannelAnalysis, ViralVideo } from "@/types";

// @anthropic-ai/sdk 를 모킹한다 (실제 네트워크/비용 없음).
const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: createMock },
  })),
}));

import Anthropic from "@anthropic-ai/sdk";
import { analyzeChannel, recommendNext } from "@/services/claude";

const AnthropicMock = Anthropic as unknown as ReturnType<typeof vi.fn>;

function mockText(text: string) {
  createMock.mockResolvedValueOnce({ content: [{ type: "text", text }] });
}

const sampleVideos: Video[] = [
  {
    id: "v1",
    title: "코딩 생산성 끌어올리는 셋업",
    description: "개발 환경 세팅",
    tags: ["코딩", "생산성"],
    viewCount: 1000,
    publishedAt: "2026-01-01T00:00:00Z",
  },
];

const sampleAnalysis: ChannelAnalysis = {
  niche: "개발자 생산성",
  topics: ["코딩", "생산성", "도구"],
  format: "튜토리얼",
  tone: "실용적",
  targetAudience: "주니어 개발자",
  summary: "실용적인 개발 생산성 채널",
};

const sampleViral: ViralVideo[] = [
  {
    id: "x1",
    title: "AI 코딩 도구 비교",
    viewCount: 500000,
    channelTitle: "DevCh",
    publishedAt: "2026-10-01T00:00:00Z",
  },
];

describe("claude service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "TEST_ANTHROPIC_KEY";
    delete process.env.ANTHROPIC_MODEL;
  });

  describe("analyzeChannel", () => {
    it("영상 목록 → JSON 응답을 파싱해 ChannelAnalysis 반환 (기본 모델)", async () => {
      mockText(JSON.stringify(sampleAnalysis));

      const result = await analyzeChannel(sampleVideos);

      expect(result).toEqual(sampleAnalysis);
      expect(AnthropicMock).toHaveBeenCalledWith({
        apiKey: "TEST_ANTHROPIC_KEY",
      });
      expect(createMock).toHaveBeenCalledTimes(1);
      const arg = createMock.mock.calls[0][0];
      expect(arg.model).toBe("claude-haiku-5-5");
    });

    it("마크다운 코드펜스(```json)로 감싼 응답도 파싱한다", async () => {
      mockText("```json\n" + JSON.stringify(sampleAnalysis) + "\n```");

      const result = await analyzeChannel(sampleVideos);
      expect(result).toEqual(sampleAnalysis);
    });

    it("ANTHROPIC_MODEL 환경변수로 모델을 교체한다", async () => {
      process.env.ANTHROPIC_MODEL = "claude-sonnet-5-5";
      mockText(JSON.stringify(sampleAnalysis));

      await analyzeChannel(sampleVideos);
      expect(createMock.mock.calls[0][0].model).toBe("claude-sonnet-5-5");
    });

    it("JSON 이 아닌 응답이면 Error throw", async () => {
      mockText("죄송하지만 분석할 수 없습니다.");
      await expect(analyzeChannel(sampleVideos)).rejects.toThrow();
    });

    it("API 키가 없으면 호출 전에 Error throw", async () => {
      delete process.env.ANTHROPIC_API_KEY;
      await expect(analyzeChannel(sampleVideos)).rejects.toThrow(
        /ANTHROPIC_API_KEY/,
      );
      expect(createMock).not.toHaveBeenCalled();
    });
  });

  describe("recommendNext", () => {
    it("분석 + 바이럴 → Recommendation[] 반환 (whyTrending/whyFitsYou 포함)", async () => {
      const recs = [
        {
          title: "AI 코딩 도구 실전 리뷰",
          angle: "직접 써보고 비교",
          whyTrending: "AI 도구 비교 영상이 급상승 중",
          whyFitsYou: "생산성 니치와 정확히 일치",
        },
      ];
      mockText(JSON.stringify({ recommendations: recs }));

      const result = await recommendNext(sampleAnalysis, sampleViral);

      expect(result).toEqual(recs);
      expect(result[0].whyTrending).toBeTruthy();
      expect(result[0].whyFitsYou).toBeTruthy();
      expect(createMock.mock.calls[0][0].model).toBe("claude-haiku-5-5");
    });

    it("JSON 배열만 반환하는 응답도 파싱한다", async () => {
      const recs = [
        {
          title: "T",
          angle: "A",
          whyTrending: "W1",
          whyFitsYou: "W2",
        },
      ];
      mockText(JSON.stringify(recs));

      const result = await recommendNext(sampleAnalysis, sampleViral, 2);
      expect(result).toEqual(recs);
    });

    it("JSON 이 아닌 응답이면 Error throw", async () => {
      mockText("추천을 생성할 수 없습니다.");
      await expect(recommendNext(sampleAnalysis, sampleViral)).rejects.toThrow();
    });

    it("API 키가 없으면 호출 전에 Error throw", async () => {
      delete process.env.ANTHROPIC_API_KEY;
      await expect(
        recommendNext(sampleAnalysis, sampleViral),
      ).rejects.toThrow(/ANTHROPIC_API_KEY/);
      expect(createMock).not.toHaveBeenCalled();
    });
  });
});
