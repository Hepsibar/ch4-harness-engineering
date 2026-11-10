// 블록 C: 다음 콘텐츠 추천(Recommendation[])을 카드로 표시한다.
// 각 카드: 제목안 / 앵글 / 왜 뜨는지(whyTrending) / 왜 나와 맞는지(whyFitsYou).
// 외부 호출 없음. props 표시 전용.

import type { Recommendation } from "@/types";

interface RecommendationListProps {
  recommendations: Recommendation[];
}

export default function RecommendationList({
  recommendations,
}: RecommendationListProps) {
  if (recommendations.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-neutral-900">
        다음 콘텐츠 추천
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {recommendations.map((rec, i) => (
          <article
            key={`${rec.title}-${i}`}
            className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5"
          >
            <h3 className="font-semibold leading-snug text-neutral-900">
              {rec.title}
            </h3>
            <p className="text-sm text-neutral-600">{rec.angle}</p>

            <div className="mt-auto flex flex-col gap-2 border-t border-neutral-100 pt-3">
              <div>
                <span className="text-xs font-medium text-red-600">
                  왜 뜨는가
                </span>
                <p className="text-sm text-neutral-700">{rec.whyTrending}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-neutral-500">
                  왜 당신과 맞는가
                </span>
                <p className="text-sm text-neutral-700">{rec.whyFitsYou}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
