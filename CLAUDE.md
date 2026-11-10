# 프로젝트: YT Next Advisor (유튜브 넥스트 콘텐츠 어드바이저)

## 기술 스택
- Next.js 15 (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- Vitest (테스트 러너)

## 아키텍처 규칙
- CRITICAL: 모든 외부 API 호출(YouTube Data API, Anthropic)은 `src/app/api/` 라우트 핸들러(서버)에서만 처리한다. 클라이언트 컴포넌트에서 직접 호출하지 않는다.
- CRITICAL: API 키는 서버 전용 환경변수로만 읽는다. `NEXT_PUBLIC_` 접두사를 붙이지 않는다 (브라우저 번들에 노출됨).
- 외부 API 래퍼는 `src/services/`, 컴포넌트는 `src/components/`, 타입은 `src/types/`, 순수 유틸은 `src/lib/`에 분리한다.

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트 (vitest run)
