import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  Channel,
  Video,
  ChannelAnalysis,
  ViralVideo,
  Recommendation,
  AnalyzeResult,
} from "@/types";

// 외부 API 는 전부 서비스 레이어를 경유한다. 서비스를 모킹해 라우트의
// 오케스트레이션(순서/조립/에러 처리)만 검증한다 (네트워크/비용 없음).
const {
  resolveChannelMock,
  getChannelVideosMock,
  searchViralVideosMock,
  analyzeChannelMock,
  recommendNextMock,
} = vi.hoisted(() => ({
  resolveChannelMock: vi.fn(),
  getChannelVideosMock: vi.fn(),
  searchViralVideosMock: vi.fn(),
  analyzeChannelMock: vi.fn(),
  recommendNextMock: vi.fn(),
}));

vi.mock("@/services/youtube", () => ({
  resolveChannel: resolveChannelMock,
  getChannelVideos: getChannelVideosMock,
  searchViralVideos: searchViralVideosMock,
}));

vi.mock("@/services/claude", () => ({
  analyzeChannel: analyzeChannelMock,
  recommendNext: recommendNextMock,
}));

import { POST } from "@/app/api/analyze/route";

const sampleChannel: Channel = {
  id: "UC123",
  title: "개발 생산성 채널",
  handle: "@devprod",
  thumbnailUrl: "https://example.com/thumb.jpg",
};

const sampleVideos: Video[] = [
  {
    id: "v1",
    title: "코딩 셋업",
    description: "환경 세팅",
    tags: ["코딩"],
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

const sampleRecs: Recommendation[] = [
  {
    title: "AI 코딩 도구 실전 리뷰",
    angle: "직접 써보고 비교",
    whyTrending: "AI 도구 비교 영상이 급상승 중",
    whyFitsYou: "생산성 니치와 일치",
  },
];

function postReq(body: unknown): Request {
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveChannelMock.mockResolvedValue(sampleChannel);
    getChannelVideosMock.mockResolvedValue(sampleVideos);
    analyzeChannelMock.mockResolvedValue(sampleAnalysis);
    searchViralVideosMock.mockResolvedValue(sampleViral);
    recommendNextMock.mockResolvedValue(sampleRecs);
  });

  it("정상 흐름: 서비스를 순서대로 호출하고 200 + AnalyzeResult 반환", async () => {
    const res = await POST(postReq({ channel: "@devprod" }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as AnalyzeResult;
    expect(body).toEqual({
      channel: sampleChannel,
      analysis: sampleAnalysis,
      viral: sampleViral,
      recommendations: sampleRecs,
    });

    // 데이터 흐름 그대로 조율됐는지 확인한다.
    expect(resolveChannelMock).toHaveBeenCalledWith("@devprod");
    expect(getChannelVideosMock).toHaveBeenCalledWith(sampleChannel.id, 20);
    expect(analyzeChannelMock).toHaveBeenCalledWith(sampleVideos);
    expect(searchViralVideosMock).toHaveBeenCalledWith(sampleAnalysis.topics, {
      publishedAfterMonths: 3,
    });
    expect(recommendNextMock).toHaveBeenCalledWith(
      sampleAnalysis,
      sampleViral,
      4,
    );
  });

  it("channel 누락 시 400 + { error } (서비스 호출 안 함)", async () => {
    const res = await POST(postReq({}));

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe("string");
    expect(resolveChannelMock).not.toHaveBeenCalled();
  });

  it("channel 이 빈 문자열이면 400", async () => {
    const res = await POST(postReq({ channel: "   " }));

    expect(res.status).toBe(400);
    expect(resolveChannelMock).not.toHaveBeenCalled();
  });

  it("잘못된 JSON 본문이면 400", async () => {
    const req = new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("서비스가 throw 하면 500 + { error }", async () => {
    resolveChannelMock.mockRejectedValue(new Error("채널을 찾을 수 없습니다"));

    const res = await POST(postReq({ channel: "@none" }));

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(typeof body.error).toBe("string");
  });

  it("에러 응답에 API 키 등 민감정보를 노출하지 않는다", async () => {
    analyzeChannelMock.mockRejectedValue(
      new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다."),
    );

    const res = await POST(postReq({ channel: "@devprod" }));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).not.toMatch(/ANTHROPIC_API_KEY/);
    expect(JSON.stringify(body)).not.toMatch(/KEY/i);
  });
});
