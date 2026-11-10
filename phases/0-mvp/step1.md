# Step 1: core-types

## 읽어야 할 파일

- `/CLAUDE.md`, `/docs/ARCHITECTURE.md`, `/docs/ADR.md`
- `/docs/PRD.md` (핵심 기능 → 어떤 데이터가 필요한지)
- Step 0 산출물: `tsconfig.json`, `src/` 구조, `vitest.config.ts`

이전 step에서 만들어진 설정을 확인하고 일관되게 작업하라.

## 작업

앱 전체가 공유할 도메인 타입을 `src/types/index.ts`에 정의한다. 순수 타입/인터페이스 레이어이며 로직·외부 호출은 넣지 않는다.

다음 인터페이스를 정의하라 (필드명은 그대로 유지할 것 — 이후 step들이 이 이름에 의존한다):

```ts
export interface Channel { id: string; title: string; handle?: string; thumbnailUrl?: string; }

export interface Video {
  id: string; title: string; description: string;
  tags: string[]; viewCount: number; publishedAt: string; // ISO8601
}

export interface ChannelAnalysis {
  niche: string;            // 한 줄 니치 정의
  topics: string[];         // 자주 다루는 주제/키워드
  format: string;           // 포맷 (예: 브이로그, 리뷰, 챌린지)
  tone: string;             // 톤/분위기
  targetAudience: string;   // 주 타깃
  summary: string;          // "넌 이런 채널이다" 한 문단
}

export interface ViralVideo {
  id: string; title: string; viewCount: number;
  channelTitle: string; publishedAt: string; whyHot?: string;
}

export interface Recommendation {
  title: string;        // 추천 제목안
  angle: string;        // 콘텐츠 앵글/후크
  whyTrending: string;  // 왜 지금 뜨는가 (ViralVideo 근거)
  whyFitsYou: string;   // 왜 당신과 맞는가 (ChannelAnalysis 근거)
}

export interface AnalyzeResult {
  channel: Channel;
  analysis: ChannelAnalysis;
  viral: ViralVideo[];
  recommendations: Recommendation[];
}
```

타입이 서로 맞물리는지 확인하는 간단한 타입/구조 테스트를 `src/types/__tests__/types.test.ts`에 작성하라 (예: 샘플 객체가 각 인터페이스를 만족하는지 컴파일+런타임 sanity 체크). TDD 원칙에 따라 테스트를 먼저 작성한다.

## Acceptance Criteria

```bash
npm run build   # 타입 컴파일 에러 없음
npm test        # 타입 테스트 통과
```

## 검증 절차

1. 위 AC 커맨드를 실행해 통과를 확인한다.
2. 아키텍처 체크리스트: 타입은 `src/types/`에만 있는가? 로직이 섞이지 않았는가? ADR 스택을 지켰는가?
3. `phases/0-mvp/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 정의한 타입 목록을 한 줄 요약
   - 실패/차단 → `"error"`/`"blocked"` + 사유

## 금지사항

- `src/services/`, `src/app/api/`, 컴포넌트를 만들지 마라. 이유: 이후 step의 범위다.
- 외부 라이브러리 타입에 의존하지 마라(순수 도메인 타입만). 이유: 레이어 분리 유지.
- 필드명을 임의로 바꾸지 마라. 이유: step 2~5가 위 이름에 의존한다.
- 기존 테스트를 깨뜨리지 마라.
