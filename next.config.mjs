// Next.js 가 넘겨주는 phase 문자열. (next/constants 를 ESM 에서 import 하면
// 해석 에러가 나므로 문자열 상수를 직접 쓴다.)
const PHASE_PRODUCTION_BUILD = "phase-production-build";

/**
 * @param {string} phase
 * @returns {import('next').NextConfig}
 */
export default function nextConfig(phase) {
  return {
    // CRITICAL: next dev 와 next build 가 같은 .next 를 공유하면 서로의 산출물을
    // 덮어써서 "Cannot find module './897.js'" / ENOENT(빌드 매니페스트) 런타임 에러가
    // 발생한다. 빌드는 별도 디렉토리(.next-prod)로 분리해 dev 서버의 .next 와 절대
    // 충돌하지 않게 한다. (dev/lint 등은 .next 사용)
    distDir: phase === PHASE_PRODUCTION_BUILD ? ".next-prod" : ".next",

    // Next.js 15.5 의 dev 전용 devtools "Segment Explorer" 버그 회피.
    // (React Client Manifest 해석 실패 → './897.js' 에러로 번지는 것을 막는다)
    experimental: { devtoolSegmentExplorer: false },

    // 홈 디렉토리의 떠돌이 package-lock.json 때문에 워크스페이스 루트가 잘못
    // 추론되는 경고를 막고, 트레이싱 루트를 이 프로젝트로 고정한다.
    outputFileTracingRoot: import.meta.dirname,
  };
}
