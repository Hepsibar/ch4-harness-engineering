// 블록 A: 채널 분석 요약(ChannelAnalysis) + 블록 B: 바이럴 영상 목록(ViralVideo[]).
// 외부 호출 없음. props 로 받은 데이터 표시만 하는 서버/프레젠테이션 컴포넌트.

import type { ChannelAnalysis, ViralVideo } from "@/types";

interface AnalysisResultProps {
  analysis: ChannelAnalysis;
  viral: ViralVideo[];
}

function formatViews(count: number): string {
  return new Intl.NumberFormat("ko-KR").format(count);
}

export default function AnalysisResult({
  analysis,
  viral,
}: AnalysisResultProps) {
  return (
    <div className="flex flex-col gap-8">
      {/* 블록 A: 채널 분석 */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-neutral-900">채널 분석</h2>

        <div className="rounded-lg border border-neutral-200 bg-white p-5">
          <p className="text-sm font-medium text-red-600">{analysis.niche}</p>
          <p className="mt-2 leading-relaxed text-neutral-700">
            {analysis.summary}
          </p>

          <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                포맷
              </dt>
              <dd className="text-neutral-800">{analysis.format}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                톤
              </dt>
              <dd className="text-neutral-800">{analysis.tone}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                타깃
              </dt>
              <dd className="text-neutral-800">{analysis.targetAudience}</dd>
            </div>
          </dl>

          {analysis.topics.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {analysis.topics.map((topic) => (
                <span
                  key={topic}
                  className="rounded-full bg-neutral-100 px-3 py-1 text-sm text-neutral-700"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 블록 B: 바이럴 영상 */}
      {viral.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-neutral-900">
            요즘 뜨는 유사 콘텐츠
          </h2>
          <ul className="flex flex-col gap-2">
            {viral.map((v) => (
              <li
                key={v.id}
                className="rounded-lg border border-neutral-200 bg-white p-4"
              >
                <p className="font-medium text-neutral-900">{v.title}</p>
                <p className="mt-1 text-sm text-neutral-500">
                  {v.channelTitle} · 조회수 {formatViews(v.viewCount)}
                </p>
                {v.whyHot && (
                  <p className="mt-2 text-sm text-neutral-600">{v.whyHot}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
