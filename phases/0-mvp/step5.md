# Step 5: ui

## 읽어야 할 파일

- `/CLAUDE.md` (CRITICAL: 클라이언트에서 외부 API 직접 호출 금지 — 자기 서버 `/api/analyze`만 호출)
- `/docs/PRD.md` (디자인: 라이트 기본, 미니멀, 무채색 + 포인트 1색)
- `/docs/ARCHITECTURE.md` (상태관리: `useState`만)
- Step 1: `src/types/index.ts` (`AnalyzeResult` 등)
- Step 4: `src/app/api/analyze/route.ts` (호출 계약: POST `{ channel }` → `AnalyzeResult`)
- Step 0: `src/app/page.tsx`, `src/app/globals.css`

## 작업

결과를 보여주는 단일 페이지 UI를 완성한다. Tailwind 사용.

1. `src/components/ChannelForm.tsx` (Client) — 채널 주소 입력 + '분석' 버튼. 제출 시 상위로 콜백.
2. `src/components/AnalysisResult.tsx` — `ChannelAnalysis`(블록 A) + `ViralVideo[]`(블록 B) 표시.
3. `src/components/RecommendationList.tsx` — `Recommendation[]`(블록 C)을 카드로 표시 (제목안·앵글·왜 뜨는지·왜 나와 맞는지).
4. `src/app/page.tsx`를 Client Component로 바꿔 전체를 조립:
   - 상태는 `useState`만: `input` / `loading` / `result | null` / `error | null`.
   - 제출 시 `fetch("/api/analyze", { method: "POST", body: JSON.stringify({ channel }) })` 호출.
   - 로딩 중: 진행 상태 표시(수집→분석→탐색→추천 문구). 에러: 사용자 친화 메시지 + 재입력 유도.

핵심 규칙:
- 외부 API를 **직접 호출하지 않는다**. 오직 `/api/analyze`만 호출한다 (CLAUDE.md CRITICAL).
- 전역 상태 라이브러리를 추가하지 않는다 (ARCHITECTURE.md). `useState`만.
- 디자인은 미니멀·라이트 기본·포인트 컬러 1가지.

테스트: 컴포넌트 렌더/상호작용 테스트는 MVP 범위에서 최소화한다. 다만 **빌드가 반드시 통과**해야 하며, 기존 단위 테스트(types/services/route)는 계속 통과해야 한다. 간단한 렌더 스모크 테스트를 추가해도 좋다(선택).

## Acceptance Criteria

```bash
npm run lint
npm run build
npm test
```

## 검증 절차

1. AC 통과 확인 (lint·build·test 모두 green — Stop 훅과 동일).
2. 체크리스트: 컴포넌트는 `src/components/`에 있는가? 클라이언트가 `/api/analyze`만 호출하는가? 전역 상태 라이브러리를 추가하지 않았는가?
3. `phases/0-mvp/index.json`의 step 5 업데이트 (completed + summary / error / blocked).

## 금지사항

- 클라이언트 컴포넌트에서 YouTube/Anthropic을 직접 호출하지 마라. 이유: CLAUDE.md CRITICAL, 키 노출.
- Redux/Zustand 등 상태관리 라이브러리를 추가하지 마라. 이유: ARCHITECTURE.md — `useState`로 충분.
- PRD의 MVP 제외 기능(로그인, 썸네일 생성, 예약 발행 등)을 만들지 마라. 이유: 범위 밖.
- 기존 테스트를 깨뜨리지 마라.
