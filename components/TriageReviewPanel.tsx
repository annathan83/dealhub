"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Deal } from "@/types";
import type { TriageSummaryContent, TriageFact } from "@/lib/services/entity/triageSummaryService";
import PassDecisionSheet from "./PassDecisionSheet";

// ─── Fact status indicator ────────────────────────────────────────────────────

function StatusDot({ status }: { status: TriageFact["status"] }) {
  if (status === "found") {
    return <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 mt-1.5" />;
  }
  if (status === "ambiguous") {
    return <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 mt-1.5" />;
  }
  return <span className="w-1.5 h-1.5 rounded-full bg-slate-200 shrink-0 mt-1.5" />;
}

// ─── Fact row ─────────────────────────────────────────────────────────────────

function FactRow({ fact }: { fact: TriageFact }) {
  const isMissing = fact.status === "missing";
  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-slate-50 last:border-0">
      <StatusDot status={fact.status} />
      <span className="text-xs text-slate-500 flex-1 leading-tight pt-0.5">{fact.label}</span>
      {isMissing ? (
        <span className="text-xs text-slate-300 italic shrink-0">—</span>
      ) : (
        <span
          className={`text-xs font-semibold tabular-nums max-w-[120px] truncate shrink-0 text-right leading-tight pt-0.5 ${
            fact.status === "ambiguous" ? "text-amber-700" : "text-slate-800"
          }`}
          title={fact.value ?? undefined}
        >
          {fact.value}
        </span>
      )}
    </div>
  );
}

// ─── Empty / loading states ───────────────────────────────────────────────────

function TriagePending() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Initial Review</h2>
          <p className="text-xs text-slate-400">Waiting for input</p>
        </div>
      </div>
      <p className="text-sm text-slate-500 leading-relaxed">
        Add files, paste text, or record audio in the Intake section above to generate an initial review.
      </p>
    </div>
  );
}

function TriageProcessing() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Extracting facts…</h2>
          <p className="text-xs text-slate-400">This takes a moment</p>
        </div>
      </div>
      <div className="space-y-2">
        {[75, 55, 65].map((w, i) => (
          <div key={i} className="h-2.5 rounded-full bg-slate-100 animate-pulse" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Decision bar ─────────────────────────────────────────────────────────────

function DecisionBar({
  onPass,
  onKeep,
  keepLoading,
}: {
  onPass: () => void;
  onKeep: () => void;
  keepLoading: boolean;
}) {
  return (
    <>
      {/* Desktop inline */}
      <div className="hidden sm:block px-5 py-4 border-t border-slate-100">
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onPass}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 active:scale-[0.98] transition-all"
            style={{ minHeight: 48 }}
          >
            Pass
          </button>
          <button
            onClick={onKeep}
            disabled={keepLoading}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 active:scale-[0.98] disabled:opacity-60 transition-all shadow-sm"
            style={{ minHeight: 48 }}
          >
            {keepLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : null}
            Keep Investigating
          </button>
        </div>
      </div>

      {/* Mobile sticky bar */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 safe-area-bottom">
        <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
          <button
            onClick={onPass}
            className="flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-600 active:bg-red-50 active:border-red-200 active:text-red-600 transition-all"
            style={{ minHeight: 52 }}
          >
            Pass
          </button>
          <button
            onClick={onKeep}
            disabled={keepLoading}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white active:bg-indigo-700 disabled:opacity-60 transition-all shadow-sm"
            style={{ minHeight: 52 }}
          >
            {keepLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : null}
            Keep Investigating
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  deal: Deal;
  triage: TriageSummaryContent | null;
  isProcessing?: boolean;
};

export default function TriageReviewPanel({ deal, triage, isProcessing }: Props) {
  const router = useRouter();
  const [passOpen, setPassOpen] = useState(false);
  const [keepLoading, setKeepLoading] = useState(false);

  if (isProcessing) return <TriageProcessing />;
  if (!triage) return <TriagePending />;

  const foundFacts = triage.facts.filter((f) => f.status !== "missing");
  const missingFacts = triage.facts.filter((f) => f.status === "missing");
  const foundCount = triage.facts_found;
  const totalCount = triage.facts.length;
  const missingCount = triage.facts_missing;

  async function handleKeepInvestigating() {
    setKeepLoading(true);
    try {
      const res = await fetch(`/api/deals/${deal.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "keep_investigating" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as Record<string, unknown>;
        console.error("keep_investigating failed:", data.error);
      }
      router.refresh();
    } catch (err) {
      console.error("keep_investigating failed:", err);
    } finally {
      setKeepLoading(false);
    }
  }

  const isAlreadyDecided =
    deal.status === "passed" ||
    deal.status === "closed";

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-slate-900">Initial Review</h2>
            </div>

            {/* Compact coverage pill */}
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
              foundCount === totalCount
                ? "bg-emerald-50 text-emerald-700"
                : missingCount > totalCount / 2
                ? "bg-amber-50 text-amber-700"
                : "bg-slate-100 text-slate-500"
            }`}>
              {foundCount}/{totalCount} facts
            </span>
          </div>

          {/* AI Summary */}
          <p className="text-sm text-slate-700 leading-relaxed">{triage.summary}</p>

          {/* Notable signals — condensed, only if present */}
          {(triage.notable_positives.length > 0 || triage.notable_concerns.length > 0) && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {triage.notable_positives.slice(0, 3).map((item, i) => (
                <span key={`p-${i}`} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                  {item}
                </span>
              ))}
              {triage.notable_concerns.slice(0, 3).map((item, i) => (
                <span key={`c-${i}`} className="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                  <span className="w-1 h-1 rounded-full bg-amber-400 shrink-0" />
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Key Facts — 2-col grid on desktop ─────────────────────────── */}
        <div className="px-5 pb-4 border-b border-slate-50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Key Facts</p>

          {/* Found / ambiguous facts in 2-col grid */}
          {foundFacts.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              {foundFacts.map((fact) => (
                <FactRow key={fact.key} fact={fact} />
              ))}
            </div>
          )}

          {/* Missing information — compact chip list */}
          {missingFacts.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-50">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
                Missing Information
                <span className="ml-1.5 text-slate-300 normal-case font-normal">({missingFacts.length})</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {missingFacts.map((fact) => (
                  <span
                    key={fact.key}
                    className="inline-flex items-center gap-1 rounded-lg bg-slate-50 border border-slate-200 px-2 py-0.5 text-[11px] text-slate-500"
                  >
                    <span className="w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                    {fact.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Decision ──────────────────────────────────────────────────── */}
        {!isAlreadyDecided && (
          <DecisionBar
            onPass={() => setPassOpen(true)}
            onKeep={handleKeepInvestigating}
            keepLoading={keepLoading}
          />
        )}

        {/* Decided state banners */}
        {isAlreadyDecided && deal.status === "passed" && (
          <div className="px-5 py-3 bg-red-50 border-t border-red-100">
            <p className="text-xs text-red-600 font-medium text-center">
              Passed
              {deal.passed_at ? ` · ${new Date(deal.passed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
              {deal.pass_reason ? ` · ${deal.pass_reason.replace(/_/g, " ")}` : ""}
            </p>
          </div>
        )}
        {isAlreadyDecided && deal.status === "closed" && (
          <div className="px-5 py-3 bg-emerald-50 border-t border-emerald-100">
            <p className="text-xs text-emerald-700 font-medium text-center">
              Deal closed
            </p>
          </div>
        )}
      </div>

      {passOpen && (
        <PassDecisionSheet deal={deal} onClose={() => setPassOpen(false)} />
      )}
    </>
  );
}
