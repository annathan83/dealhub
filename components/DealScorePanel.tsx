"use client";

/**
 * DealScorePanel
 *
 * Displays the latest AI deal opinion: score gauge, verdict badge,
 * score delta vs previous run, risk flags, missing info, and a
 * "Re-analyze" button that calls POST /api/deals/[id]/analyze.
 *
 * When opinion is null (no analysis run yet) it renders a prompt card
 * inviting the user to run the first analysis.
 */

import { useState, useTransition } from "react";
import type { DealOpinion, DealOpinionDelta, AIDealVerdict } from "@/types";

// ─── Verdict config ───────────────────────────────────────────────────────────

const VERDICT_STYLES: Record<
  AIDealVerdict,
  { bg: string; text: string; dot: string }
> = {
  "Strong Buy": {
    bg: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  "Proceed with Caution": {
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-700",
    dot: "bg-amber-500",
  },
  "Needs More Info": {
    bg: "bg-blue-50 border-blue-200",
    text: "text-blue-700",
    dot: "bg-blue-400",
  },
  Pass: {
    bg: "bg-red-50 border-red-200",
    text: "text-red-700",
    dot: "bg-red-500",
  },
};

// ─── Score gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color =
    clamped >= 70
      ? "#10b981"
      : clamped >= 45
      ? "#f59e0b"
      : "#ef4444";

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="96" height="96" viewBox="0 0 96 96">
        {/* Track */}
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="8"
        />
        {/* Progress */}
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 48 48)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text
          x="48"
          y="53"
          textAnchor="middle"
          fontSize="20"
          fontWeight="700"
          fill={color}
        >
          {clamped}
        </text>
      </svg>
      <span className="text-xs text-slate-400">out of 100</span>
    </div>
  );
}

// ─── Score delta badge ────────────────────────────────────────────────────────

function ScoreDelta({ delta }: { delta: DealOpinionDelta }) {
  const change = delta.score_change;
  if (change === null) return null;

  const isPositive = change > 0;
  const isNeutral = change === 0;

  if (isNeutral) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-slate-400 font-medium">
        <span>→</span> No change
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
        isPositive ? "text-emerald-600" : "text-red-500"
      }`}
    >
      {isPositive ? "▲" : "▼"} {Math.abs(change)} pts vs last run
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  dealId: string;
  opinion: DealOpinion | null;
  delta: DealOpinionDelta | null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DealScorePanel({ dealId, opinion, delta }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(
    opinion?.created_at ?? null
  );

  function handleAnalyze() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/deals/${dealId}/analyze`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error ?? "Analysis failed. Please try again.");
        } else {
          setLastRunAt(new Date().toISOString());
          // Reload to show updated opinion
          window.location.reload();
        }
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  const verdictStyle = opinion?.ai_verdict
    ? VERDICT_STYLES[opinion.ai_verdict]
    : null;

  // ── Empty state ─────────────────────────────────────────────────────────
  if (!opinion) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-100 flex items-center gap-2">
          <span className="text-base">🤖</span>
          <h3 className="text-sm font-semibold text-slate-700">AI Deal Score</h3>
        </div>
        <div className="p-5 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-2xl">
            🧠
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">
            No analysis run yet. Add entries or files, then run the AI analysis
            to get a deal score and verdict.
          </p>
          <button
            onClick={handleAnalyze}
            disabled={isPending}
            className="mt-1 w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors"
          >
            {isPending ? "Analyzing…" : "Run Analysis"}
          </button>
          {error && (
            <p className="text-xs text-red-500 mt-1">{error}</p>
          )}
        </div>
      </div>
    );
  }

  // ── Populated state ─────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">🤖</span>
          <h3 className="text-sm font-semibold text-slate-700">AI Deal Score</h3>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={isPending}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:opacity-50 transition-colors"
        >
          {isPending ? "Analyzing…" : "Re-analyze"}
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {/* Score + verdict */}
        <div className="flex items-center gap-4">
          {opinion.ai_deal_score !== null ? (
            <ScoreGauge score={opinion.ai_deal_score} />
          ) : (
            <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs text-center px-2">
              Score pending
            </div>
          )}

          <div className="flex-1 flex flex-col gap-2">
            {opinion.ai_verdict && verdictStyle && (
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold w-fit ${verdictStyle.bg} ${verdictStyle.text}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${verdictStyle.dot}`} />
                {opinion.ai_verdict}
              </span>
            )}

            {delta && <ScoreDelta delta={delta} />}

            {lastRunAt && (
              <span className="text-xs text-slate-400">
                {new Date(lastRunAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </div>
        </div>

        {/* Running summary */}
        {opinion.running_summary && (
          <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
            {opinion.running_summary}
          </p>
        )}

        {/* Risk flags */}
        {opinion.risk_flags.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Risk Flags
            </p>
            <ul className="flex flex-col gap-1.5">
              {opinion.risk_flags.map((flag, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <span
                    className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      flag.severity === "high"
                        ? "bg-red-500"
                        : flag.severity === "medium"
                        ? "bg-amber-400"
                        : "bg-slate-300"
                    }`}
                  />
                  {flag.flag}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Missing information */}
        {opinion.missing_information.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Missing Information
            </p>
            <ul className="flex flex-col gap-1.5">
              {opinion.missing_information.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-300 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Broker questions */}
        {opinion.broker_questions.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Suggested Questions
            </p>
            <ul className="flex flex-col gap-1.5">
              {opinion.broker_questions.map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="mt-0.5 text-indigo-400 flex-shrink-0">?</span>
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Delta summary (verdict change) */}
        {delta?.verdict_changed && delta.verdict_before && delta.verdict_after && (
          <div className="border-t border-slate-100 pt-3 bg-amber-50 rounded-lg px-3 py-2">
            <p className="text-xs text-amber-700 font-medium">
              Verdict changed: {delta.verdict_before} → {delta.verdict_after}
            </p>
          </div>
        )}

        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
      </div>
    </div>
  );
}
