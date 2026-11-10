# Step 0: project-setup

## 읽어야 할 파일

먼저 아래 파일들을 읽고 프로젝트의 아키텍처와 설계 의도를 파악하라:

- `/CLAUDE.md` (기술 스택, CRITICAL 규칙)
- `/docs/PRD.md`, `/docs/ARCHITECTURE.md`, `/docs/ADR.md`
- `/.env.example` (환경변수 이름 확인 — 수정하지 말 것)

아직 소스 코드는 없다. 이 step은 빈 스캐폴드를 만드는 단계다.

## 작업

Next.js 15 App Router + TypeScript(strict) + Tailwind + Vitest 프로젝트를 스캐폴드한다.

1. **package.json** 생성:
   - dependencies: `next@15`, `react`, `react-dom`, `@anthropic-ai/sdk`
   - devDependencies: `typescript`, `@types/react`, `@types/node`, `tailwindcss`, `postcss`, `autoprefixer`, `vitest`, `eslint`, `eslint-config-next`
   - scripts: `"dev": "next dev"`, `"build": "next build"`, `"lint": "next lint"`, `"test": "vitest run"`
2. **tsconfig.json**: strict 모드, path alias `@/*` → `./src/*`.
3. **Tailwind**: `tailwind.config.ts`(content에 `./src/**/*.{ts,tsx}`), `postcss.config.js`, `src/app/globals.css`(`@tailwind base/components/utilities`).
4. **ESLint**: `.eslintrc.json` (`{ "extends": "next/core-web-vitals" }`).
5. **Vitest**: `vitest.config.ts` (test environment `node`, globals 사용 가능하게).
6. **앱 뼈대**:
   - `src/app/layout.tsx` — globals.css import, `<html lang="ko">`, 기본 메타.
   - `src/app/page.tsx` — Server Component. 플레이스홀더 제목 "YT Next Advisor"와 한 줄 설명만. (폼/로직 없음)
7. **스모크 테스트**: `src/lib/__tests__/smoke.test.ts` — 빌드/테스트 파이프라인이 도는지 확인하는 sanity 테스트 1개.
8. 의존성 설치: `npm install` 실행.

핵심 규칙(반드시 지킬 것):
- lint·build·test 세 커맨드가 **모두 통과(green)** 하는 상태로 끝내라. (프로젝트의 Stop 훅이 이 셋을 실행한다)
- 환경변수는 `process.env.YOUTUBE_API_KEY`, `process.env.ANTHROPIC_API_KEY`로 **서버에서만** 읽는다는 전제다. 이 step에서 실제로 읽지는 않는다.

## Acceptance Criteria

```bash
npm install
npm run lint
npm run build
npm test
```

## 검증 절차

1. 위 AC 커맨드를 순서대로 실행해 모두 통과하는지 확인한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md의 `src/` 디렉토리 구조를 따르는가?
   - ADR의 기술 스택(Next.js 15 / TS strict / Tailwind / Vitest)을 벗어나지 않았는가?
   - CLAUDE.md CRITICAL 규칙을 위반하지 않았는가?
3. 결과에 따라 `phases/0-mvp/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary": "생성된 설정/파일 한 줄 요약"`
   - 수정 3회 후에도 실패 → `"status": "error"`, `"error_message": "구체적 에러"`
   - 사용자 개입 필요 → `"status": "blocked"`, `"blocked_reason": "사유"` 후 중단

## 금지사항

- `googleapis` 등 무거운 SDK를 설치하지 마라. 이유: MVP는 `fetch`로 충분하며 번들을 불필요하게 키운다.
- `src/app/api/` 라우트나 `src/services/` 로직을 작성하지 마라. 이유: 이후 step(2~4)의 범위다.
- `.env.example`, `.gitignore`를 수정하지 마라. 이유: 이미 올바르게 설정되어 있다.
- `.env.local`을 커밋하거나 읽지 마라. 이유: 비밀 키 파일이며 .gitignore 대상이다.
- 기존 테스트를 깨뜨리지 마라.
