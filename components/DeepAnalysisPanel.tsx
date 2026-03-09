"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  DeepAnalysisContent,
  DeepAnalysisRisk,
  DeepAnalysisBrokerQuestion,
} from "@/lib/services/entity/deepAnalysisService";
import type { DealStatus } from "@/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

// ─── Severity pill ────────────────────────────────────────────────────────────

function SeverityPill({ severity }: { severity: DeepAnalysisRisk["severity"] }) {
  const styles: Record<DeepAnalysisRisk["severity"], string> = {
    high:   "bg-red-50 text-red-700 border-red-100",
    medium: "bg-amber-50 text-amber-700 border-amber-100",
    low:    "bg-slate-50 text-slate-500 border-slate-200",
  };
  const dots: Record<DeepAnalysisRisk["severity"], string> = {
    high:   "bg-red-500",
    medium: "bg-amber-400",
    low:    "bg-slate-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0 ${styles[severity]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[severity]}`} />
      {severity}
    </span>
  );
}

// ─── Empty / blocked state ────────────────────────────────────────────────────

function NeverRunState({
  dealStatus,
  onStart,
  loading,
  error,
}: {
  dealStatus: DealStatus;
  onStart: () => void;
  loading: boolean;
  error: string | null;
}) {
  const isBlocked = dealStatus === "passed" || dealStatus === "archived";
  const isNew = dealStatus === "new";

  if (isBlocked) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-700">Deep Analysis unavailable</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              This deal is marked as <span className="font-medium capitalize">{dealStatus}</span>. Change the deal status to run a deep analysis.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Icon + description */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Deep Analysis</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isNew ? "Complete the initial review first" : "Not yet run"}
            </p>
          </div>
        </div>

        {isNew ? (
          <p className="text-sm text-slate-500 leading-relaxed">
            Add a listing, broker email, or financial document first. Once the initial review is complete, you can run a deep analysis.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-600 leading-relaxed mb-3">
              Deep Analysis uses all extracted text and structured facts to produce:
            </p>
            <ul className="space-y-1.5 mb-4">
              {[
                ["Executive summary", "Neutral synthesis of what is known"],
                ["Key risks", "Structured list ordered by severity"],
                ["Broker questions", "Prioritized follow-up questions"],
                ["Valuation support", "Numbers + explicit caveats"],
              ].map(([title, desc]) => (
                <li key={title} className="flex items-start gap-2">
                  <svg className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">{title}</span>
                    {" — "}{desc}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 mb-3">
            <p className="text-xs font-semibold text-red-700 mb-0.5">Analysis failed</p>
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* CTA */}
      {!isNew && (
        <div className="px-5 pb-5">
          <button
            onClick={onStart}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-60 transition-all shadow-sm"
            style={{ minHeight: 48 }}
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Running Deep Analysis…
              </>
            ) : (
              <>
                <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Run Deep Analysis
              </>
            )}
          </button>
          <p className="text-[11px] text-slate-400 text-center mt-2">
            Uses stored text — no files are re-uploaded
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Collapsible section ──────────────────────────────────────────────────────

function Section({
  title,
  badge,
  badgeVariant = "neutral",
  children,
  defaultOpen = true,
}: {
  title: string;
  badge?: string | number;
  badgeVariant?: "neutral" | "red" | "indigo" | "amber";
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const badgeStyles: Record<string, string> = {
    neutral: "bg-slate-100 text-slate-500",
    red:     "bg-red-50 text-red-600",
    indigo:  "bg-indigo-50 text-indigo-600",
    amber:   "bg-amber-50 text-amber-600",
  };

  return (
    <div className="border-t border-slate-50 first:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50/60 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {title}
          </span>
          {badge !== undefined && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${badgeStyles[badgeVariant]}`}>
              {badge}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-slate-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

// ─── Risk list ────────────────────────────────────────────────────────────────

function RiskList({ risks }: { risks: DeepAnalysisRisk[] }) {
  if (risks.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic">
        No significant risks identified from available data.
      </p>
    );
  }

  // Group by severity for visual hierarchy
  const high   = risks.filter((r) => r.severity === "high");
  const medium = risks.filter((r) => r.severity === "medium");
  const low    = risks.filter((r) => r.severity === "low");

  return (
    <div className="space-y-2">
      {[...high, ...medium, ...low].map((risk, i) => (
        <div
          key={i}
          className="rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-3"
        >
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 shrink-0">
              <SeverityPill severity={risk.severity} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 leading-snug">{risk.title}</p>
              {risk.detail && (
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">{risk.detail}</p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Broker questions ─────────────────────────────────────────────────────────

function BrokerQuestions({ questions }: { questions: DeepAnalysisBrokerQuestion[] }) {
  if (questions.length === 0) {
    return (
      <p className="text-sm text-slate-400 italic">No broker questions generated.</p>
    );
  }

  const high   = questions.filter((q) => q.priority === "high");
  const medium = questions.filter((q) => q.priority === "medium");

  return (
    <div className="space-y-2">
      {[...high, ...medium].map((q, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-3"
        >
          <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-50 text-indigo-600 text-[11px] font-bold flex items-center justify-center mt-0.5">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-800 leading-snug">{q.question}</p>
            {q.context && (
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">{q.context}</p>
            )}
            {q.priority === "high" && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-600">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                High priority
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Valuation support ────────────────────────────────────────────────────────

function ValuationSupport({ v }: { v: DeepAnalysisContent["valuation_support"] }) {
  const metrics = [
    { label: "Asking Price",     value: v.asking_price },
    { label: "Latest SDE",       value: v.latest_sde },
    { label: "Latest EBITDA",    value: v.latest_ebitda },
    { label: "Implied Multiple", value: v.implied_multiple },
  ];

  const availableCount = metrics.filter((m) => m.value).length;

  return (
    <div className="space-y-3">
      {/* Incomplete data warning — shown prominently when data is thin */}
      {!v.data_sufficient && (
        <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-3">
          <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-xs font-semibold text-amber-800">Incomplete valuation data</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              {availableCount === 0
                ? "No asking price or earnings figures were found. Request financials from the broker."
                : "Asking price and at least one earnings figure (SDE or EBITDA) are needed for a meaningful comparison."}
            </p>
          </div>
        </div>
      )}

      {/* Metrics grid — show all, dim missing */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {metrics.map(({ label, value }) => (
          <div
            key={label}
            className={`rounded-xl p-3 ${value ? "bg-slate-50" : "bg-slate-50/40 border border-dashed border-slate-200"}`}
          >
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-sm font-bold tabular-nums ${value ? "text-slate-900" : "text-slate-300"}`}>
              {value ?? "—"}
            </p>
          </div>
        ))}
      </div>

      {/* Commentary — always shown */}
      {v.commentary && (
        <p className="text-sm text-slate-600 leading-relaxed">{v.commentary}</p>
      )}
    </div>
  );
}

// ─── Data gaps ────────────────────────────────────────────────────────────────

function DataGaps({ gaps }: { gaps: string[] }) {
  if (gaps.length === 0) return null;
  return (
    <ul className="space-y-1.5">
      {gaps.map((gap, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
          <svg className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {gap}
        </li>
      ))}
    </ul>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  dealId: string;
  dealStatus: DealStatus;
  analysis: DeepAnalysisContent | null;
  isStale: boolean;
  runAt: string | null;
  latestSourceAt: string | null;
};

export default function DeepAnalysisPanel({
  dealId,
  dealStatus,
  analysis,
  isStale,
  runAt,
  latestSourceAt,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRunAnalysis(trigger = "manual_run") {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/deals/${dealId}/deep-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trigger }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as Record<string, unknown>;
        throw new Error((data.error as string) ?? "Deep analysis failed. Please try again.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // ── Empty / blocked state ──────────────────────────────────────────────────
  if (!analysis) {
    return (
      <NeverRunState
        dealStatus={dealStatus}
        onStart={() => handleRunAnalysis("manual_run")}
        loading={loading}
        error={error}
      />
    );
  }

  const canRerun = dealStatus !== "passed" && dealStatus !== "archived";
  const highRiskCount = analysis.key_risks.filter((r) => r.severity === "high").length;
  const highPriorityQCount = analysis.broker_questions.filter((q) => q.priority === "high").length;

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-50">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Deep Analysis</h2>
              {runAt && (
                <p className="text-xs text-slate-400" title={formatDate(runAt)}>
                  Last analyzed {relativeTime(runAt)}
                </p>
              )}
            </div>
          </div>

          {/* Re-run button — desktop */}
          {canRerun && (
            <button
              onClick={() => handleRunAnalysis("re_run")}
              disabled={loading}
              className="hidden sm:inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] disabled:opacity-50 transition-all"
              style={{ minHeight: 32 }}
            >
              {loading ? (
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              {loading ? "Running…" : "Re-run"}
            </button>
          )}
        </div>

        {/* Stale banner — new information added since last run */}
        {isStale && !loading && (
          <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 border border-amber-100 px-3.5 py-3 mb-3">
            <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-800">
                New information added
                {latestSourceAt ? ` ${relativeTime(latestSourceAt)}` : ""}
              </p>
              <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
                Documents or text were added after this analysis ran. Re-run to include the latest information.
              </p>
            </div>
            {canRerun && (
              <button
                onClick={() => handleRunAnalysis("re_run_after_new_files")}
                disabled={loading}
                className="shrink-0 rounded-lg bg-amber-100 hover:bg-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-800 transition-colors disabled:opacity-50"
              >
                Re-run
              </button>
            )}
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-100 px-3.5 py-3 mb-3">
            <p className="text-xs font-semibold text-red-700 mb-0.5">Analysis failed</p>
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        {/* Executive summary */}
        <p className="text-sm text-slate-700 leading-relaxed">{analysis.executive_summary}</p>
      </div>

      {/* ── Key Risks ─────────────────────────────────────────────────── */}
      <Section
        title="Key Risks"
        badge={analysis.key_risks.length}
        badgeVariant={highRiskCount > 0 ? "red" : "neutral"}
        defaultOpen
      >
        <RiskList risks={analysis.key_risks} />
      </Section>

      {/* ── Broker Questions ──────────────────────────────────────────── */}
      <Section
        title="Broker Questions"
        badge={analysis.broker_questions.length}
        badgeVariant={highPriorityQCount > 0 ? "indigo" : "neutral"}
        defaultOpen
      >
        <BrokerQuestions questions={analysis.broker_questions} />
      </Section>

      {/* ── Valuation Support ─────────────────────────────────────────── */}
      <Section
        title="Valuation Support"
        badgeVariant={analysis.valuation_support.data_sufficient ? "neutral" : "amber"}
        badge={analysis.valuation_support.data_sufficient ? undefined : "Incomplete"}
        defaultOpen
      >
        <ValuationSupport v={analysis.valuation_support} />
      </Section>

      {/* ── Data Gaps ─────────────────────────────────────────────────── */}
      {analysis.data_gaps.length > 0 && (
        <Section
          title="Data Gaps"
          badge={analysis.data_gaps.length}
          defaultOpen={false}
        >
          <DataGaps gaps={analysis.data_gaps} />
        </Section>
      )}

      {/* ── Mobile re-run button ───────────────────────────────────────── */}
      {canRerun && (
        <div className="sm:hidden px-5 py-4 border-t border-slate-50">
          <button
            onClick={() => handleRunAnalysis("re_run")}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 active:bg-slate-50 disabled:opacity-50 transition-all"
            style={{ minHeight: 48 }}
          >
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {loading ? "Running…" : "Re-run Deep Analysis"}
          </button>
        </div>
      )}

      {/* ── Footer metadata ───────────────────────────────────────────── */}
      <div className="px-5 py-2.5 border-t border-slate-50 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
        {runAt && (
          <span title={relativeTime(runAt)}>{formatDate(runAt)}</span>
        )}
        {analysis.model_name && <span>· {analysis.model_name}</span>}
        {analysis.prompt_version && <span>· {analysis.prompt_version}</span>}
        {analysis.trigger && (
          <span className="ml-auto capitalize">{analysis.trigger.replace(/_/g, " ")}</span>
        )}
      </div>
    </div>
  );
}
