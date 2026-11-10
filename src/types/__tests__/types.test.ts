import { describe, it, expect } from "vitest";
import type {
  Channel,
  Video,
  ChannelAnalysis,
  ViralVideo,
  Recommendation,
  AnalyzeResult,
} from "@/types";

describe("core domain types", () => {
  it("Channel: 필수/선택 필드를 만족하는 샘플 객체", () => {
    const channel: Channel = {
      id: "UC123",
      title: "내 채널",
      handle: "@mychannel",
      thumbnailUrl: "https://example.com/thumb.jpg",
    };
    expect(channel.id).toBe("UC123");
    expect(channel.title).toBe("내 채널");

    // handle / thumbnailUrl 는 선택적
    const minimal: Channel = { id: "UC456", title: "미니멀 채널" };
    expect(minimal.handle).toBeUndefined();
    expect(minimal.thumbnailUrl).toBeUndefined();
  });

  it("Video: 메타데이터 필드 구조", () => {
    const video: Video = {
      id: "vid1",
      title: "영상 제목",
      description: "영상 설명",
      tags: ["vlog", "daily"],
      viewCount: 12345,
      publishedAt: "2026-01-01T00:00:00Z",
    };
    expect(video.tags).toHaveLength(2);
    expect(typeof video.viewCount).toBe("number");
    expect(video.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("ChannelAnalysis: 분석 요약 필드", () => {
    const analysis: ChannelAnalysis = {
      niche: "1인 개발 브이로그",
      topics: ["코딩", "생산성"],
      format: "브이로그",
      tone: "담백하고 솔직한",
      targetAudience: "주니어 개발자",
      summary: "너는 개발 과정을 솔직하게 기록하는 채널이다.",
    };
    expect(analysis.topics).toContain("코딩");
    expect(analysis.niche.length).toBeGreaterThan(0);
  });

  it("ViralVideo: 바이럴 후보 영상 구조", () => {
    const viral: ViralVideo = {
      id: "viral1",
      title: "요즘 뜨는 영상",
      viewCount: 1000000,
      channelTitle: "다른 채널",
      publishedAt: "2026-10-01T00:00:00Z",
      whyHot: "알고리즘 추천 급상승",
    };
    expect(viral.viewCount).toBeGreaterThan(0);

    // whyHot 는 선택적
    const withoutWhy: ViralVideo = {
      id: "viral2",
      title: "뜨는 영상 2",
      viewCount: 500000,
      channelTitle: "채널 B",
      publishedAt: "2026-10-05T00:00:00Z",
    };
    expect(withoutWhy.whyHot).toBeUndefined();
  });

  it("Recommendation: 추천 카드 필드", () => {
    const rec: Recommendation = {
      title: "다음 콘텐츠 제목안",
      angle: "콘텐츠 앵글/후크",
      whyTrending: "유사 바이럴 영상이 급상승 중",
      whyFitsYou: "네 니치와 톤에 부합",
    };
    expect(rec.title.length).toBeGreaterThan(0);
    expect(rec.whyTrending.length).toBeGreaterThan(0);
    expect(rec.whyFitsYou.length).toBeGreaterThan(0);
  });

  it("AnalyzeResult: 전체 응답이 하위 타입을 합성한다", () => {
    const result: AnalyzeResult = {
      channel: { id: "UC123", title: "내 채널" },
      analysis: {
        niche: "개발 브이로그",
        topics: ["코딩"],
        format: "브이로그",
        tone: "솔직한",
        targetAudience: "개발자",
        summary: "요약",
      },
      viral: [
        {
          id: "v1",
          title: "뜨는 영상",
          viewCount: 999999,
          channelTitle: "채널 X",
          publishedAt: "2026-09-01T00:00:00Z",
        },
      ],
      recommendations: [
        {
          title: "추천 1",
          angle: "앵글",
          whyTrending: "트렌드 근거",
          whyFitsYou: "핏 근거",
        },
      ],
    };

    expect(result.channel.id).toBe("UC123");
    expect(result.analysis.format).toBe("브이로그");
    expect(result.viral).toHaveLength(1);
    expect(result.recommendations).toHaveLength(1);
  });
});
