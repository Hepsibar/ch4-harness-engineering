# Architecture Decision Records

## 철학
MVP 속도 최우선. 외부 의존성 최소화. 작동하는 최소 구현을 선택한다. DB·인증 없이, 요청 시 즉석 분석만 한다.

---

### ADR-001: Next.js 15 App Router + 서버 전용 API 호출
**결정**: Next.js App Router를 쓰고, YouTube·Anthropic 호출은 `app/api/analyze` 라우트 핸들러(서버)에서만 한다.
**이유**: 프런트와 백엔드를 한 프로젝트로 묶어 MVP를 빠르게 만들고, API 키를 서버에만 두어 노출을 막는다.
**트레이드오프**: 라우트 핸들러가 수집·분석·추천을 모두 조율해 다소 무거워진다(MVP 범위에서 허용).

### ADR-002: 분석/추천 엔진으로 Anthropic Claude 사용
**결정**: 콘텐츠 분석과 다음 콘텐츠 추천은 Anthropic SDK(`@anthropic-ai/sdk`)로 Claude를 호출해 처리한다. 기본 모델은 `claude-haiku-5-5`, `ANTHROPIC_MODEL` 환경변수로 교체 가능.
**이유**: 자유형식 텍스트(제목·설명)에서 니치를 요약하고 아이디어를 생성하는 데 LLM이 적합하고, 규칙 기반보다 구현이 짧다.
**트레이드오프**: 호출당 비용/지연 발생, 출력이 비결정적 → 구조화 출력(JSON) 파싱과 검증 필요.

### ADR-003: 저장소 없음 + Vitest 테스트
**결정**: DB·캐시·인증을 두지 않고 요청마다 즉석 계산한다. 테스트 러너는 Vitest로 통일하고, 외부 API(YouTube/Anthropic)는 모킹해 단위 테스트한다.
**이유**: MVP는 영속성이 불필요하다. Vitest는 설정이 가볍고 Next/TS와 잘 맞아 TDD 사이클이 빠르다.
**트레이드오프**: 매 요청 외부 API를 다시 호출(쿼터·비용 반복). 모킹 기반 테스트라 실제 API 계약 변경은 별도 확인 필요.
