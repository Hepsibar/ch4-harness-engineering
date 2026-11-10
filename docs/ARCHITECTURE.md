# 아키텍처

## 디렉토리 구조
```
src/
├── app/
│   ├── page.tsx           # 입력 폼 + 결과 표시 (단일 페이지)
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       └── analyze/
│           └── route.ts   # POST: 채널 → 분석 + 추천 (오케스트레이션)
├── components/            # UI 컴포넌트 (ChannelForm, AnalysisResult, RecommendationList)
├── types/                # TypeScript 타입 정의 (Channel, Video, ChannelAnalysis, Recommendation)
├── lib/                  # 순수 유틸 (채널 입력 파싱 등)
└── services/             # 외부 API 래퍼 (youtube.ts, claude.ts)
```

## 패턴
- Server Components 기본. 입력 폼 등 인터랙션이 필요한 곳만 Client Component (`"use client"`).
- 외부 API 호출은 전부 서버(`services/` → `api/analyze/route.ts`)에서만. 클라이언트는 자체 API 라우트만 호출한다.
- `services/`는 외부 SDK/HTTP 경계를 감싼 얇은 래퍼. 비즈니스 흐름(수집→분석→추천)은 라우트 핸들러가 조율한다.

## 데이터 흐름
```
사용자가 채널 입력
  → Client Component(ChannelForm)가 POST /api/analyze
    → route.ts: youtube.resolveChannel + getChannelVideos (수집)
    → claude.analyzeChannel(영상) → ChannelAnalysis (분석)
    → youtube.searchViralVideos(분석 키워드) → 후보 영상 (탐색)
    → claude.recommendNext(분석, 후보) → Recommendation[] (추천)
  → JSON 응답 → UI 렌더링(AnalysisResult + RecommendationList)
```

## 상태 관리
- 서버 상태는 라우트 핸들러가 요청마다 즉석 계산(영속 저장 없음).
- 클라이언트 상태는 `useState`만 사용(입력값, 로딩, 결과). 전역 상태 라이브러리 없음.
