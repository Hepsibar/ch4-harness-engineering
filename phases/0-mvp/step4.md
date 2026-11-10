# Step 4: analyze-api

## 읽어야 할 파일

- `/CLAUDE.md` (CRITICAL: 모든 외부 API 로직은 `app/api/` 라우트 핸들러에서만)
- `/docs/ARCHITECTURE.md` (데이터 흐름), `/docs/ADR.md`
- Step 1: `src/types/index.ts` (`AnalyzeResult`)
- Step 2: `src/services/youtube.ts`
- Step 3: `src/services/claude.ts`

## 작업

유일한 서버 엔드포인트를 `src/app/api/analyze/route.ts`에 작성한다. 수집→분석→탐색→추천을 순서대로 조율한다.

```ts
// POST /api/analyze   body: { channel: string }   →  AnalyzeResult (200)
export async function POST(req: Request): Promise<Response>;
```

오케스트레이션 순서(ARCHITECTURE.md 데이터 흐름 그대로):
1. body에서 `channel` 문자열을 받는다. 없으면 400.
2. `resolveChannel(channel)` → `getChannelVideos(channel.id, 20)`
3. `analyzeChannel(videos)` → `ChannelAnalysis`
4. `searchViralVideos(analysis.topics, { publishedAfterMonths: 3 })` → `ViralVideo[]`
5. `recommendNext(analysis, viral, 4)` → `Recommendation[]`
6. `AnalyzeResult`를 JSON으로 반환.

핵심 규칙:
- 이 라우트는 Node 런타임 서버에서 실행된다. 서비스 함수만 호출하고, 외부 API를 직접 호출하지 않는다(서비스 레이어 경유).
- 에러 처리: 키 누락/외부 호출 실패/파싱 실패를 잡아 적절한 상태코드(400/500)와 `{ error: string }` JSON으로 응답한다. 민감정보(키 등)를 응답에 넣지 않는다.
- 비즈니스 로직을 서비스에 중복 구현하지 말고 조율만 한다.

테스트(TDD, 먼저 작성): `src/app/api/analyze/__tests__/route.test.ts`
- `@/services/youtube`와 `@/services/claude`를 `vi.mock`으로 모킹한다.
- 정상 흐름: 모킹된 서비스가 순서대로 호출되고 200 + `AnalyzeResult` 형태를 반환하는지.
- `channel` 누락 시 400, 서비스가 throw 하면 500 + `{ error }` 반환하는지.

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. AC 통과 확인 (서비스 모킹).
2. 체크리스트: 외부 호출이 전부 서비스 경유인가? 라우트는 `src/app/api/analyze/`에 있는가? 키를 응답에 노출하지 않는가?
3. `phases/0-mvp/index.json`의 step 4 업데이트 (completed + summary / error / blocked).

## 금지사항

- 라우트에서 `fetch`로 YouTube/Anthropic을 직접 호출하지 마라. 이유: CLAUDE.md CRITICAL — 로직은 서비스 레이어에.
- UI/컴포넌트를 만들지 마라. 이유: step 5의 범위다.
- 에러 응답에 스택트레이스나 키를 포함하지 마라. 이유: 정보 노출.
- 기존 테스트를 깨뜨리지 마라.
