// 유일한 서버 엔드포인트 (Node 런타임).
// POST /api/analyze  body: { channel: string }  →  AnalyzeResult (200)
//
// 역할: 수집→분석→탐색→추천을 "조율"만 한다 (ARCHITECTURE.md 데이터 흐름).
// - 외부 API 는 직접 호출하지 않고 전부 services/ 레이어를 경유한다 (CLAUDE.md CRITICAL).
// - 비즈니스 로직은 서비스에 있다. 여기서는 순서대로 호출하고 결과를 조립할 뿐.
// - 에러는 상태코드(400/500) + { error } JSON 으로 응답하며, 키/스택 등 민감정보는 노출하지 않는다.

import { NextResponse } from "next/server";
import {
  resolveChannel,
  getChannelVideos,
  searchViralVideos,
} from "@/services/youtube";
import { analyzeChannel, recommendNext } from "@/services/claude";
import type { AnalyzeResult } from "@/types";

export const runtime = "nodejs";

function errorResponse(status: number, message: string): Response {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request): Promise<Response> {
  // 1. 입력 파싱/검증
  let channel: unknown;
  try {
    const body = (await req.json()) as { channel?: unknown };
    channel = body?.channel;
  } catch {
    return errorResponse(400, "요청 본문이 올바른 JSON 이 아닙니다.");
  }

  if (typeof channel !== "string" || channel.trim() === "") {
    return errorResponse(400, "channel 값이 필요합니다.");
  }

  // 2~5. 수집 → 분석 → 탐색 → 추천 (서비스 경유)
  try {
    const resolved = await resolveChannel(channel);
    const videos = await getChannelVideos(resolved.id, 20);
    const analysis = await analyzeChannel(videos);
    const viral = await searchViralVideos(analysis.topics, {
      publishedAfterMonths: 3,
    });
    const recommendations = await recommendNext(analysis, viral, 4);

    const result: AnalyzeResult = {
      channel: resolved,
      analysis,
      viral,
      recommendations,
    };
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    // 내부 에러 상세(키/스택 등)는 응답에 싣지 않는다. 서버 로그로만 남긴다.
    console.error("[/api/analyze] 처리 실패:", err);
    return errorResponse(
      500,
      "분석 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
}
