# Step 2: youtube-service

## 읽어야 할 파일

- `/CLAUDE.md` (CRITICAL: 외부 API는 서버에서만, 키는 `NEXT_PUBLIC_` 금지)
- `/docs/ARCHITECTURE.md`, `/docs/ADR.md`
- Step 1 산출물: `src/types/index.ts` (`Channel`, `Video`, `ViralVideo`)
- `/.env.example` (`YOUTUBE_API_KEY`)

이전 step의 타입을 그대로 import 해서 쓰라.

## 작업

YouTube Data API v3 래퍼를 작성한다. **`googleapis` SDK를 쓰지 말고 `fetch`로 REST 호출**한다 (ADR-003).

1. `src/lib/parseChannel.ts` — 입력 문자열 파싱 (순수 함수, 네트워크 없음):
   ```ts
   // "@handle", "https://youtube.com/@handle", "youtube.com/channel/UC...", 순수 "UC..." 등을 구분
   export function parseChannelInput(input: string): { handle?: string; channelId?: string } | null;
   ```
2. `src/services/youtube.ts` — 키는 `process.env.YOUTUBE_API_KEY`로 읽는다:
   ```ts
   export async function resolveChannel(input: string): Promise<Channel>;
   // parseChannelInput 사용 → channels.list (forHandle 또는 id) 호출 → Channel
   export async function getChannelVideos(channelId: string, max = 20): Promise<Video[]>;
   // 채널의 최근 업로드 영상(기본 20개)의 제목/설명/태그/조회수/게시일
   export async function searchViralVideos(
     keywords: string[],
     opts?: { max?: number; publishedAfterMonths?: number }
   ): Promise<ViralVideo[]>;
   // 기본: 최근 3개월(publishedAfterMonths=3) 내, order=viewCount, max=15
   ```

핵심 규칙:
- 키가 없으면(`process.env.YOUTUBE_API_KEY` 비어있음) 명확한 Error를 throw 한다 (호출부가 처리). 이 때문에 step을 blocked 하지 마라 — 테스트는 fetch를 모킹하므로 실제 키가 필요 없다.
- 호출 실패(비200) 시 상태코드와 함께 Error throw.
- 이 파일들은 **서버 전용**이다. 클라이언트에서 import 되지 않는다.

테스트(TDD, 먼저 작성): `src/services/__tests__/youtube.test.ts`, `src/lib/__tests__/parseChannel.test.ts`
- `global.fetch`를 `vi.fn()`으로 모킹해 각 함수가 올바른 URL/파라미터를 만들고 응답을 올바른 타입으로 매핑하는지 검증한다.
- 실제 네트워크 호출은 하지 않는다.

## Acceptance Criteria

```bash
npm run build
npm test
```

## 검증 절차

1. AC 통과 확인 (모킹 기반, 네트워크 없음).
2. 체크리스트: 서비스는 `src/services/`, 파싱 유틸은 `src/lib/`에 있는가? `googleapis`를 쓰지 않았는가? 키를 서버에서만 읽는가?
3. `phases/0-mvp/index.json`의 step 2 업데이트 (completed + summary / error / blocked).

## 금지사항

- `googleapis` 설치·사용 금지. 이유: ADR-003, 번들·복잡도 증가.
- `NEXT_PUBLIC_` 접두사 환경변수 사용 금지. 이유: 키가 브라우저에 노출된다 (CLAUDE.md CRITICAL).
- 테스트에서 실제 YouTube API를 호출하지 마라. 이유: 쿼터 소모·비결정성.
- API 라우트나 컴포넌트를 만들지 마라. 이유: step 4·5의 범위다.
- 기존 테스트를 깨뜨리지 마라.
