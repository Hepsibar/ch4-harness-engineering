import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  resolveChannel,
  getChannelVideos,
  searchViralVideos,
} from "@/services/youtube";

function mockFetchOnce(data: unknown, ok = true, status = 200) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok,
    status,
    json: async () => data,
  });
}

function callUrl(i: number): string {
  return (global.fetch as ReturnType<typeof vi.fn>).mock.calls[i][0] as string;
}

describe("youtube service", () => {
  beforeEach(() => {
    process.env.YOUTUBE_API_KEY = "TEST_KEY";
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("resolveChannel", () => {
    it("핸들 입력 → forHandle 파라미터로 channels.list 호출 후 Channel 매핑", async () => {
      mockFetchOnce({
        items: [
          {
            id: "UC_abc",
            snippet: {
              title: "내 채널",
              customUrl: "@mychannel",
              thumbnails: { default: { url: "https://img/thumb.jpg" } },
            },
          },
        ],
      });

      const channel = await resolveChannel("@mychannel");

      expect(channel).toEqual({
        id: "UC_abc",
        title: "내 채널",
        handle: "@mychannel",
        thumbnailUrl: "https://img/thumb.jpg",
      });

      const url = callUrl(0);
      expect(url).toContain("/channels");
      expect(url).toContain("forHandle=mychannel");
      expect(url).toContain("part=snippet");
      expect(url).toContain("key=TEST_KEY");
    });

    it("채널 ID 입력 → id 파라미터 사용 (forHandle 없음)", async () => {
      mockFetchOnce({
        items: [{ id: "UC1234567890123456789012", snippet: { title: "T" } }],
      });

      const channel = await resolveChannel("UC1234567890123456789012");

      expect(channel.id).toBe("UC1234567890123456789012");
      const url = callUrl(0);
      expect(url).toContain("id=UC1234567890123456789012");
      expect(url).not.toContain("forHandle");
    });

    it("items 가 비어있으면 Error", async () => {
      mockFetchOnce({ items: [] });
      await expect(resolveChannel("@none")).rejects.toThrow();
    });

    it("비200 응답 → 상태코드를 포함한 Error", async () => {
      mockFetchOnce({}, false, 403);
      await expect(resolveChannel("@x")).rejects.toThrow(/403/);
    });
  });

  describe("키 부재", () => {
    it("YOUTUBE_API_KEY 가 없으면 fetch 전에 Error throw", async () => {
      delete process.env.YOUTUBE_API_KEY;
      await expect(resolveChannel("@x")).rejects.toThrow(/YOUTUBE_API_KEY/);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("getChannelVideos", () => {
    it("search(date) → videos(snippet,statistics) 2단계 호출 후 Video[] 매핑", async () => {
      mockFetchOnce({
        items: [{ id: { videoId: "v1" } }, { id: { videoId: "v2" } }],
      });
      mockFetchOnce({
        items: [
          {
            id: "v1",
            snippet: {
              title: "T1",
              description: "D1",
              tags: ["a", "b"],
              publishedAt: "2026-01-01T00:00:00Z",
            },
            statistics: { viewCount: "100" },
          },
          {
            id: "v2",
            snippet: {
              title: "T2",
              description: "D2",
              publishedAt: "2026-02-01T00:00:00Z",
            },
            statistics: { viewCount: "200" },
          },
        ],
      });

      const videos = await getChannelVideos("UC_abc", 2);

      expect(videos).toHaveLength(2);
      expect(videos[0]).toEqual({
        id: "v1",
        title: "T1",
        description: "D1",
        tags: ["a", "b"],
        viewCount: 100,
        publishedAt: "2026-01-01T00:00:00Z",
      });
      // tags 가 없으면 빈 배열, viewCount 는 number
      expect(videos[1].tags).toEqual([]);
      expect(typeof videos[1].viewCount).toBe("number");
      expect(videos[1].viewCount).toBe(200);

      const searchUrl = callUrl(0);
      expect(searchUrl).toContain("/search");
      expect(searchUrl).toContain("channelId=UC_abc");
      expect(searchUrl).toContain("order=date");
      expect(searchUrl).toContain("type=video");
      expect(searchUrl).toContain("maxResults=2");

      const videosUrl = callUrl(1);
      expect(videosUrl).toContain("/videos");
      expect(videosUrl).toContain("part=snippet%2Cstatistics");
      expect(videosUrl).toContain("id=v1%2Cv2");
    });

    it("검색 결과가 없으면 videos 호출 없이 빈 배열", async () => {
      mockFetchOnce({ items: [] });
      const videos = await getChannelVideos("UC_abc");
      expect(videos).toEqual([]);
      expect(
        (global.fetch as ReturnType<typeof vi.fn>).mock.calls,
      ).toHaveLength(1);
    });
  });

  describe("searchViralVideos", () => {
    it("기본값: order=viewCount, maxResults=15, publishedAfter 설정, ViralVideo 매핑", async () => {
      mockFetchOnce({ items: [{ id: { videoId: "x1" } }] });
      mockFetchOnce({
        items: [
          {
            id: "x1",
            snippet: {
              title: "Hot",
              channelTitle: "Ch",
              publishedAt: "2026-10-01T00:00:00Z",
            },
            statistics: { viewCount: "999999" },
          },
        ],
      });

      const viral = await searchViralVideos(["코딩", "생산성"]);

      expect(viral).toHaveLength(1);
      expect(viral[0]).toEqual({
        id: "x1",
        title: "Hot",
        viewCount: 999999,
        channelTitle: "Ch",
        publishedAt: "2026-10-01T00:00:00Z",
      });

      const searchUrl = callUrl(0);
      expect(searchUrl).toContain("/search");
      expect(searchUrl).toContain("order=viewCount");
      expect(searchUrl).toContain("maxResults=15");
      expect(searchUrl).toContain("publishedAfter=");
      // q 는 키워드를 합친 문자열
      const decoded = decodeURIComponent(searchUrl);
      expect(decoded).toContain("코딩");
      expect(decoded).toContain("생산성");
    });

    it("opts 로 max / publishedAfterMonths 를 재정의", async () => {
      mockFetchOnce({ items: [] });
      const viral = await searchViralVideos(["x"], {
        max: 5,
        publishedAfterMonths: 1,
      });
      expect(viral).toEqual([]);
      const searchUrl = callUrl(0);
      expect(searchUrl).toContain("maxResults=5");
      expect(searchUrl).toContain("publishedAfter=");
    });
  });
});
