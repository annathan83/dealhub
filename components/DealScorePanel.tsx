"use client";

/**
 * DealScorePanel
 *
 * Displays the latest AI deal assessment from analysis_snapshots.
 * Score, verdict, summary, risk flags, missing info, broker questions.
 * Has a "Run Analysis" button that calls POST /api/deals/[id]/analysis.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AnalysisSnapshot } from "@/types/entity";

type Props = {
  dealId: string;
  snapshot: AnalysisSnapshot | null;
  hasEntries?: boolean;
};

// ─── Verdict config ───────────────────────────────────────────────────────────

type VerdictKey = "strong_buy" | "buy" | "hold" | "pass";

const VERDICT_CONFIG: Record<VerdictKey, { label: string; bg: string; text: string; dot: string }> = {
  strong_buy: { label: "Strong Buy",              bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
  buy:        { label: "Buy",                     bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-400" },
  hold:       { label: "Proceed with Caution",    bg: "bg-amber-50 border-amber-200",     text: "text-amber-700",   dot: "bg-amber-500"   },
  pass:       { label: "Pass",                    bg: "bg-red-50 border-red-200",         text: "text-red-700",     dot: "bg-red-500"     },
};

// ─── Score gauge ──────────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color = clamped >= 70 ? "#10b981" : clamped >= 45 ? "#f59e0b" : "#ef4444";
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="48" cy="48" r={radius}
          fill="none" stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          transform="rotate(-90 48 48)"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <text x="48" y="53" textAnchor="middle" fontSize="20" fontWeight="700" fill={color}>
          {clamped}
        </text>
      </svg>
      <span className="text-xs text-slate-400">out of 100</span>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DealScorePanel({ dealId, snapshot, hasEntries = true }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastRunAt, setLastRunAt] = useState<string | null>(snapshot?.created_at ?? null);

  function handleAnalyze() {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/deals/${dealId}/analysis`, { method: "POST" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string };
          setError(body.error ?? "Analysis failed. Please try again.");
        } else {
          setLastRunAt(new Date().toISOString());
          router.refresh();
        }
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  // Parse content from snapshot
  const content = snapshot?.content_json as Record<string, unknown> | null | undefined;
  const score = typeof content?.score === "number" ? content.score : null;
  const verdictKey = typeof content?.verdict === "string" ? content.verdict as VerdictKey : null;
  const summary = typeof content?.summary === "string" ? content.summary : null;
  const riskFlags = Array.isArray(content?.risk_flags) ? content.risk_flags as string[] : [];
  const missingInfo = Array.isArray(content?.missing_information) ? content.missing_information as string[] : [];
  const brokerQuestions = Array.isArray(content?.broker_questions) ? content.broker_questions as string[] : [];

  const verdictCfg = verdictKey ? VERDICT_CONFIG[verdictKey] : null;

  // ── Empty state ─────────────────────────────────────────────────────────────
  if (!snapshot || score === null) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-100 flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <h3 className="text-sm font-semibold text-slate-700">AI Deal Score</h3>
        </div>
        <div className="p-5 flex flex-col items-center gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <p className="text-sm text-slate-500 leading-relaxed">
            Add entries or upload files, then run the AI analysis to get a deal score and verdict.
          </p>
          <button
            onClick={handleAnalyze}
            disabled={isPending || !hasEntries}
            title={!hasEntries ? "Add entries or files before running analysis" : undefined}
            className="mt-1 w-full py-2 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {isPending ? "Analyzing…" : "Run Analysis"}
          </button>
          {!hasEntries && <p className="text-xs text-slate-400">Add entries or files first</p>}
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
        </div>
      </div>
    );
  }

  // ── Populated state ─────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
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
          <ScoreGauge score={score} />
          <div className="flex-1 flex flex-col gap-2">
            {verdictCfg && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold w-fit ${verdictCfg.bg} ${verdictCfg.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${verdictCfg.dot}`} />
                {verdictCfg.label}
              </span>
            )}
            {lastRunAt && (
              <span className="text-xs text-slate-400">
                {new Date(lastRunAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
        </div>

        {/* Summary */}
        {summary && (
          <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
            {summary}
          </p>
        )}

        {/* Risk flags */}
        {riskFlags.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Risk Flags</p>
            <ul className="flex flex-col gap-1.5">
              {riskFlags.map((flag, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  {flag}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Missing information */}
        {missingInfo.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Missing Information</p>
            <ul className="flex flex-col gap-1.5">
              {missingInfo.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="mt-0.5 w-1.5 h-1.5 rounded-full bg-blue-300 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Broker questions */}
        {brokerQuestions.length > 0 && (
          <div className="border-t border-slate-100 pt-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Suggested Questions</p>
            <ul className="flex flex-col gap-1.5">
              {brokerQuestions.map((q, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                  <span className="mt-0.5 text-indigo-400 flex-shrink-0">?</span>
                  {q}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}
