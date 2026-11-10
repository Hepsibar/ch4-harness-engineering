"use client";

// 단일 페이지 UI 조립.
// 상태는 useState 만 사용(ARCHITECTURE.md): input / loading / result / error.
// 외부 API 직접 호출 금지(CLAUDE.md CRITICAL) — 오직 자기 서버 /api/analyze 만 호출한다.

import { useState } from "react";
import ChannelForm from "@/components/ChannelForm";
import AnalysisResult from "@/components/AnalysisResult";
import RecommendationList from "@/components/RecommendationList";
import type { AnalyzeResult } from "@/types";

const PROGRESS_STEPS = ["수집", "분석", "탐색", "추천"] as const;

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    const channel = input.trim();
    if (channel === "" || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          data?.error ?? "분석에 실패했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }

      const data = (await res.json()) as AnalyzeResult;
      setResult(data);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "분석에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-neutral-900">
          YT Next Advisor
        </h1>
        <p className="text-neutral-600">
          내 유튜브 채널을 분석해 다음에 만들 콘텐츠를 추천합니다.
        </p>
      </header>

      <ChannelForm
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        loading={loading}
      />

      {loading && (
        <div
          className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-6"
          role="status"
          aria-live="polite"
        >
          <p className="text-neutral-700">채널을 분석하고 있습니다…</p>
          <ol className="flex flex-wrap items-center gap-2 text-sm text-neutral-500">
            {PROGRESS_STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-2">
                <span className="rounded-full bg-neutral-100 px-3 py-1">
                  {label}
                </span>
                {i < PROGRESS_STEPS.length - 1 && (
                  <span aria-hidden className="text-neutral-300">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {error && !loading && (
        <div
          className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-5"
          role="alert"
        >
          <p className="font-medium text-red-700">{error}</p>
          <p className="text-sm text-red-600">
            채널 주소를 다시 확인하고 분석을 시도해 주세요.
          </p>
        </div>
      )}

      {result && !loading && (
        <div className="flex flex-col gap-10">
          <AnalysisResult analysis={result.analysis} viral={result.viral} />
          <RecommendationList recommendations={result.recommendations} />
        </div>
      )}
    </main>
  );
}
