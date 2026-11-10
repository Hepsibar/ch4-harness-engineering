# Step 3: claude-service

## 읽어야 할 파일

- `/CLAUDE.md`, `/docs/ARCHITECTURE.md`, `/docs/ADR.md` (ADR-002: Claude 사용, 모델 기본값)
- Step 1 산출물: `src/types/index.ts` (`Video`, `ChannelAnalysis`, `ViralVideo`, `Recommendation`)
- Step 2 산출물: `src/services/youtube.ts` (호출 스타일 참고)
- `/.env.example` (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`)

## 작업

Anthropic(Claude) 래퍼를 `src/services/claude.ts`에 작성한다. `@anthropic-ai/sdk` 사용.

```ts
export async function analyzeChannel(videos: Video[]): Promise<ChannelAnalysis>;
// 영상들의 제목/설명/태그를 요약해 채널 정체성(ChannelAnalysis)을 만든다.

export async function recommendNext(
  analysis: ChannelAnalysis,
  viral: ViralVideo[],
  count = 4
): Promise<Recommendation[]>;
// 정체성 + 바이럴 후보를 근거로 다음 콘텐츠 추천(기본 4개)을 만든다.
```

핵심 규칙:
- 클라이언트 생성: `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })`. 키 없으면 명확한 Error throw.
- 모델: `process.env.ANTHROPIC_MODEL ?? "claude-haiku-5-5"`.
- **구조화 출력**: 프롬프트로 JSON만 출력하도록 지시하고, 응답 텍스트를 파싱해 타입으로 반환한다. 파싱 실패 시 Error throw(호출부가 처리).
- 각 `Recommendation`은 `whyTrending`(바이럴 근거)과 `whyFitsYou`(정체성 근거)를 반드시 채운다.
- 서버 전용 모듈.

테스트(TDD, 먼저 작성): `src/services/__tests__/claude.test.ts`
- `@anthropic-ai/sdk`를 `vi.mock`으로 모킹해, 가짜 JSON 응답을 돌려주고 각 함수가 올바른 타입으로 파싱/반환하는지 검증한다.
- 잘못된(JSON 아님) 응답에서 Error를 throw 하는지도 검증한다.
- 실제 API 호출은 하지 않는다.

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. AC 통과 확인 (SDK 모킹, 네트워크 없음).
2. 체크리스트: `src/services/`에 위치? 모델 기본값/ env 처리 올바른가? 타입을 재사용했는가?
3. `phases/0-mvp/index.json`의 step 3 업데이트 (completed + summary / error / blocked).

## 금지사항

- 테스트에서 실제 Anthropic API를 호출하지 마라. 이유: 비용·비결정성.
- 모델 id를 임의의 다른 값으로 하드코딩하지 마라. 이유: ADR-002에서 기본값은 `claude-haiku-5-5`, env로 교체.
- `NEXT_PUBLIC_` 접두사 사용 금지. 이유: 키 노출.
- API 라우트/컴포넌트를 만들지 마라. 이유: step 4·5의 범위다.
- 기존 테스트를 깨뜨리지 마라.
