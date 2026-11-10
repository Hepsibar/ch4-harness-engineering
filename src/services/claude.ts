// Anthropic(Claude) 래퍼 (서버 전용).
// - @anthropic-ai/sdk 로 Claude 를 호출해 채널 분석/추천을 수행한다 (ADR-002).
// - 키는 process.env.ANTHROPIC_API_KEY 로만 읽는다 (NEXT_PUBLIC_ 금지).
// - 모델 기본값 claude-haiku-5-5, ANTHROPIC_MODEL 로 교체 가능.
// - 구조화 출력: 프롬프트로 JSON 만 출력하게 지시하고 응답을 파싱한다.
// - 이 파일은 클라이언트에서 import 되지 않는다.

import Anthropic from "@anthropic-ai/sdk";
import type {
  Video,
  ChannelAnalysis,
  ViralVideo,
  Recommendation,
} from "@/types";

const DEFAULT_MODEL = "claude-haiku-5-5";
const MAX_TOKENS = 2048;

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다. 서버 환경변수를 확인하세요.",
    );
  }
  return new Anthropic({ apiKey });
}

function getModel(): string {
  return process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;
}

/** 응답 블록에서 텍스트만 추출해 합친다. */
function extractText(message: unknown): string {
  const blocks =
    (message as { content?: Array<Record<string, unknown>> }).content ?? [];
  return blocks
    .filter((b) => b?.type === "text")
    .map((b) => String(b.text ?? ""))
    .join("\n")
    .trim();
}

/** 코드펜스를 벗기고 JSON 으로 파싱한다. 실패 시 Error. */
function parseJson<T>(raw: string): T {
  let text = raw.trim();
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) text = fenced[1].trim();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Claude 응답을 JSON 으로 파싱할 수 없습니다: ${raw.slice(0, 200)}`,
    );
  }
}

async function complete(prompt: string): Promise<string> {
  const client = getClient();
  const message = await client.messages.create({
    model: getModel(),
    max_tokens: MAX_TOKENS,
    messages: [{ role: "user", content: prompt }],
  });
  return extractText(message);
}

/**
 * 영상들의 제목/설명/태그를 요약해 채널 정체성(ChannelAnalysis)을 만든다.
 */
export async function analyzeChannel(
  videos: Video[],
): Promise<ChannelAnalysis> {
  const corpus = videos
    .map((v, i) => {
      const tags = v.tags.length ? ` | 태그: ${v.tags.join(", ")}` : "";
      return `${i + 1}. [${v.viewCount}회] ${v.title}${tags}\n   ${v.description}`;
    })
    .join("\n");

  const prompt = `당신은 유튜브 콘텐츠 전략가입니다. 아래는 한 채널의 최근 영상 목록입니다.
이 채널의 정체성(니치/주제/포맷/톤/타깃)을 분석하세요.

영상 목록:
${corpus}

반드시 아래 스키마의 JSON 객체 "하나만" 출력하세요. 설명/코드펜스/추가 텍스트 금지.
{
  "niche": "한 줄 니치 정의",
  "topics": ["자주 다루는 주제/키워드", "..."],
  "format": "주된 포맷 (예: 브이로그, 리뷰, 튜토리얼)",
  "tone": "톤/분위기",
  "targetAudience": "주 타깃 시청자",
  "summary": "이 채널이 어떤 채널인지 한 문단 요약"
}`;

  const text = await complete(prompt);
  return parseJson<ChannelAnalysis>(text);
}

/**
 * 정체성 + 바이럴 후보를 근거로 다음 콘텐츠 추천(기본 4개)을 만든다.
 */
export async function recommendNext(
  analysis: ChannelAnalysis,
  viral: ViralVideo[],
  count = 4,
): Promise<Recommendation[]> {
  const viralList = viral
    .map(
      (v, i) =>
        `${i + 1}. [${v.viewCount}회] ${v.title} (채널: ${v.channelTitle})`,
    )
    .join("\n");

  const prompt = `당신은 유튜브 콘텐츠 전략가입니다.

[내 채널 정체성]
${JSON.stringify(analysis, null, 2)}

[요즘 같은 분야에서 바이럴한 영상들]
${viralList}

위 정체성과 바이럴 근거를 바탕으로, 이 채널이 다음에 만들면 좋을 콘텐츠를 ${count}개 추천하세요.
각 추천은 "whyTrending"(바이럴 근거)과 "whyFitsYou"(정체성 근거)를 반드시 채우세요.

반드시 아래 스키마의 JSON "만" 출력하세요. 설명/코드펜스/추가 텍스트 금지.
{
  "recommendations": [
    {
      "title": "추천 제목안",
      "angle": "콘텐츠 앵글/후크",
      "whyTrending": "왜 지금 뜨는가 (바이럴 영상 근거)",
      "whyFitsYou": "왜 이 채널과 맞는가 (정체성 근거)"
    }
  ]
}`;

  const text = await complete(prompt);
  const parsed = parseJson<
    Recommendation[] | { recommendations?: Recommendation[] }
  >(text);

  const list = Array.isArray(parsed) ? parsed : parsed.recommendations;
  if (!Array.isArray(list)) {
    throw new Error(
      "Claude 응답에서 recommendations 배열을 찾을 수 없습니다.",
    );
  }
  return list;
}
