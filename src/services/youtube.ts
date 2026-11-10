// YouTube Data API v3 래퍼 (서버 전용).
// - googleapis SDK 를 쓰지 않고 fetch 로 REST 호출한다 (ADR-003).
// - 키는 process.env.YOUTUBE_API_KEY 로만 읽는다 (NEXT_PUBLIC_ 금지).
// - 이 파일은 클라이언트에서 import 되지 않는다.

import type { Channel, Video, ViralVideo } from "@/types";
import { parseChannelInput } from "@/lib/parseChannel";

const API_BASE = "https://www.googleapis.com/youtube/v3";

function getApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    throw new Error(
      "YOUTUBE_API_KEY 환경변수가 설정되지 않았습니다. 서버 환경변수를 확인하세요.",
    );
  }
  return key;
}

async function ytFetch(
  resource: string,
  params: Record<string, string>,
): Promise<Record<string, unknown>> {
  const key = getApiKey();
  const url = new URL(`${API_BASE}/${resource}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(
      `YouTube API 요청 실패 (${res.status}): ${resource}`,
    );
  }
  return (await res.json()) as Record<string, unknown>;
}

function toVideo(item: Record<string, any>): Video {
  const snippet = item.snippet ?? {};
  const statistics = item.statistics ?? {};
  return {
    id: item.id,
    title: snippet.title ?? "",
    description: snippet.description ?? "",
    tags: snippet.tags ?? [],
    viewCount: Number(statistics.viewCount ?? 0),
    publishedAt: snippet.publishedAt ?? "",
  };
}

function toViralVideo(item: Record<string, any>): ViralVideo {
  const snippet = item.snippet ?? {};
  const statistics = item.statistics ?? {};
  return {
    id: item.id,
    title: snippet.title ?? "",
    viewCount: Number(statistics.viewCount ?? 0),
    channelTitle: snippet.channelTitle ?? "",
    publishedAt: snippet.publishedAt ?? "",
  };
}

function collectVideoIds(searchData: Record<string, any>): string[] {
  const items = (searchData.items ?? []) as Array<Record<string, any>>;
  return items
    .map((it) => it.id?.videoId)
    .filter((id): id is string => Boolean(id));
}

/**
 * 채널 입력(핸들/URL/ID)을 해석해 channels.list 로 Channel 을 가져온다.
 */
export async function resolveChannel(input: string): Promise<Channel> {
  const parsed = parseChannelInput(input);
  if (!parsed) {
    throw new Error(`채널 입력을 해석할 수 없습니다: "${input}"`);
  }

  const params: Record<string, string> = { part: "snippet" };
  if (parsed.channelId) {
    params.id = parsed.channelId;
  } else if (parsed.handle) {
    params.forHandle = parsed.handle;
  }

  const data = await ytFetch("channels", params);
  const items = (data.items ?? []) as Array<Record<string, any>>;
  const item = items[0];
  if (!item) {
    throw new Error(`채널을 찾을 수 없습니다: "${input}"`);
  }

  const snippet = item.snippet ?? {};
  return {
    id: item.id,
    title: snippet.title ?? "",
    handle: snippet.customUrl,
    thumbnailUrl: snippet.thumbnails?.default?.url,
  };
}

/**
 * 채널의 최근 업로드 영상(기본 20개)을 제목/설명/태그/조회수/게시일로 가져온다.
 * search.list(order=date)로 영상 ID 수집 → videos.list 로 상세/통계 조회.
 */
export async function getChannelVideos(
  channelId: string,
  max = 20,
): Promise<Video[]> {
  const searchData = await ytFetch("search", {
    part: "id",
    channelId,
    order: "date",
    type: "video",
    maxResults: String(max),
  });

  const ids = collectVideoIds(searchData);
  if (ids.length === 0) return [];

  const videosData = await ytFetch("videos", {
    part: "snippet,statistics",
    id: ids.join(","),
  });
  const items = (videosData.items ?? []) as Array<Record<string, any>>;
  return items.map(toVideo);
}

/**
 * 분석된 니치 키워드로 요즘 바이럴한 유사 콘텐츠를 탐색한다.
 * 기본: 최근 3개월, order=viewCount, max=15.
 */
export async function searchViralVideos(
  keywords: string[],
  opts: { max?: number; publishedAfterMonths?: number } = {},
): Promise<ViralVideo[]> {
  const max = opts.max ?? 15;
  const months = opts.publishedAfterMonths ?? 3;
  const publishedAfter = new Date(
    Date.now() - months * 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // 분석 topics 는 긴 서술형일 수 있으므로 검색 친화적으로 정리한다:
  // 괄호 안 보조설명/특수문자를 제거하고 상위 토큰만 사용해 과도한 구체화를 막는다.
  const q = keywords
    .map((k) => k.replace(/\([^)]*\)/g, " ").replace(/[\/,|·]+/g, " "))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 8)
    .join(" ");

  async function searchIds(withDate: boolean): Promise<string[]> {
    const params: Record<string, string> = {
      part: "id",
      q,
      type: "video",
      order: "viewCount",
      maxResults: String(max),
    };
    if (withDate) params.publishedAfter = publishedAfter;
    return collectVideoIds(await ytFetch("search", params));
  }

  // 최근 N개월 우선, 결과가 없으면 기간 제한을 풀어 한 번 더 시도한다.
  let ids = await searchIds(true);
  if (ids.length === 0) ids = await searchIds(false);
  if (ids.length === 0) return [];

  const videosData = await ytFetch("videos", {
    part: "snippet,statistics",
    id: ids.join(","),
  });
  const items = (videosData.items ?? []) as Array<Record<string, any>>;
  return items.map(toViralVideo);
}
