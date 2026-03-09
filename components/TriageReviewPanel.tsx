"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Deal } from "@/types";
import type { TriageSummaryContent, TriageFact } from "@/lib/services/entity/triageSummaryService";
import PassDecisionSheet from "./PassDecisionSheet";

// ─── Fact status badge ────────────────────────────────────────────────────────

function FactStatusBadge({ status }: { status: TriageFact["status"] }) {
  if (status === "found") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Found
      </span>
    );
  }
  if (status === "ambiguous") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        Needs review
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400 shrink-0">
      <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
      Missing
    </span>
  );
}

// ─── Fact row — shown for ALL facts (found, ambiguous, and missing) ───────────

function FactRow({ fact }: { fact: TriageFact }) {
  const isMissing = fact.status === "missing";
  return (
    <div className="flex items-center justify-between gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <span className="text-sm text-slate-600 min-w-0 truncate">{fact.label}</span>
      <div className="flex items-center gap-2 shrink-0">
        {isMissing ? (
          <span className="text-sm text-slate-300 italic select-none">—</span>
        ) : (
          <span
            className={`text-sm font-semibold tabular-nums max-w-[140px] truncate ${
              fact.status === "ambiguous" ? "text-amber-700" : "text-slate-900"
            }`}
            title={fact.value ?? undefined}
          >
            {fact.value}
          </span>
        )}
        <FactStatusBadge status={fact.status} />
      </div>
    </div>
  );
}

// ─── Chip list ────────────────────────────────────────────────────────────────

function ChipList({
  items,
  variant,
}: {
  items: string[];
  variant: "positive" | "concern";
}) {
  if (items.length === 0) return null;

  const styles = {
    positive: "bg-emerald-50 text-emerald-800 border-emerald-100",
    concern:  "bg-amber-50 text-amber-800 border-amber-100",
  };

  const icons = {
    positive: (
      <svg className="w-3 h-3 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    concern: (
      <svg className="w-3 h-3 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
    ),
  };

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {items.map((item, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${styles[variant]}`}
        >
          {icons[variant]}
          {item}
        </span>
      ))}
    </div>
  );
}

// ─── Empty / loading states ───────────────────────────────────────────────────

function TriagePending() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Initial Review</h2>
          <p className="text-xs text-slate-400">Waiting for information</p>
        </div>
      </div>
      <p className="text-sm text-slate-500 leading-relaxed">
        Paste a listing, broker email, or financial summary to generate an initial review. Key facts will be extracted and summarized automatically.
      </p>
    </div>
  );
}

function TriageProcessing() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">Initial Review</h2>
          <p className="text-xs text-slate-400">Extracting facts…</p>
        </div>
      </div>
      <div className="space-y-2">
        {[80, 60, 70].map((w, i) => (
          <div key={i} className="h-3 rounded bg-slate-100 animate-pulse" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Decision bar — sticky on mobile ─────────────────────────────────────────

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
      {/* Inline bar (desktop / within-card) */}
      <div className="hidden sm:block px-5 py-4 bg-slate-50/60 border-t border-slate-100">
        <p className="text-xs text-slate-400 mb-3 text-center">
          What would you like to do with this deal?
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onPass}
            className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 hover:border-red-300 active:scale-[0.98] transition-all"
            style={{ minHeight: 48 }}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
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
            ) : (
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
            )}
            Keep Investigating
          </button>
        </div>
      </div>

      {/* Sticky bottom bar (mobile only) */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 px-4 py-3 safe-area-bottom">
        <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
          <button
            onClick={onPass}
            className="flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3.5 text-sm font-semibold text-red-600 active:bg-red-50 active:scale-[0.98] transition-all"
            style={{ minHeight: 52 }}
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Pass
          </button>
          <button
            onClick={onKeep}
            disabled={keepLoading}
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3.5 text-sm font-semibold text-white active:bg-indigo-700 active:scale-[0.98] disabled:opacity-60 transition-all shadow-sm"
            style={{ minHeight: 52 }}
          >
            {keepLoading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
            )}
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

  // Show ALL facts — found, ambiguous, and missing — so nothing is silently hidden
  const allFacts = triage.facts;
  const foundCount = triage.facts_found;
  const totalCount = triage.facts.length;

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
    deal.status === "investigating" ||
    deal.status === "loi" ||
    deal.status === "acquired";

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-50">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Initial Review</h2>
                <p className="text-xs text-slate-400">
                  {foundCount} of {totalCount} key facts found
                </p>
              </div>
            </div>

            {/* Fact coverage bar — desktop only */}
            <div className="hidden sm:flex items-center gap-2 shrink-0 mt-0.5">
              <div className="w-24 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-400 transition-all"
                  style={{ width: `${Math.round((foundCount / totalCount) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-slate-400 tabular-nums">
                {Math.round((foundCount / totalCount) * 100)}%
              </span>
            </div>
          </div>

          {/* AI Summary — neutral, grounded, no directive language */}
          <p className="text-sm text-slate-700 leading-relaxed">{triage.summary}</p>

          {/* Notable positives / concerns chips */}
          {triage.notable_positives.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Notable</p>
              <ChipList items={triage.notable_positives} variant="positive" />
            </div>
          )}
          {triage.notable_concerns.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Flags</p>
              <ChipList items={triage.notable_concerns} variant="concern" />
            </div>
          )}
        </div>

        {/* ── Key Facts — ALL facts shown, missing ones explicitly labeled ── */}
        <div className="px-5 py-4 border-b border-slate-50">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Key Facts</p>
            {triage.facts_missing > 0 && (
              <span className="text-[10px] text-slate-400 tabular-nums">
                {triage.facts_missing} missing
              </span>
            )}
          </div>
          <div className="divide-y divide-slate-50">
            {allFacts.map((fact) => (
              <FactRow key={fact.key} fact={fact} />
            ))}
          </div>
        </div>

        {/* ── Decision Bar (inline for desktop) / Decided state ─────────── */}
        {!isAlreadyDecided && (
          <DecisionBar
            onPass={() => setPassOpen(true)}
            onKeep={handleKeepInvestigating}
            keepLoading={keepLoading}
          />
        )}

        {/* Decided state banners */}
        {isAlreadyDecided && deal.status === "passed" && (
          <div className="px-5 py-3.5 bg-red-50 border-t border-red-100">
            <p className="text-xs text-red-600 font-medium text-center">
              Archived as Passed
              {deal.passed_at
                ? ` on ${new Date(deal.passed_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                : ""}
              {deal.pass_reason ? ` · ${deal.pass_reason.replace(/_/g, " ")}` : ""}
            </p>
          </div>
        )}
        {isAlreadyDecided && deal.status === "investigating" && (
          <div className="px-5 py-3.5 bg-indigo-50 border-t border-indigo-100">
            <p className="text-xs text-indigo-700 font-medium text-center">
              Marked for further investigation. Use the Deep Analysis tab to go deeper.
            </p>
          </div>
        )}
        {isAlreadyDecided && (deal.status === "loi" || deal.status === "acquired") && (
          <div className="px-5 py-3.5 bg-emerald-50 border-t border-emerald-100">
            <p className="text-xs text-emerald-700 font-medium text-center capitalize">
              Deal status: {deal.status.replace(/_/g, " ")}
            </p>
          </div>
        )}
      </div>

      {/* Pass decision sheet */}
      {passOpen && (
        <PassDecisionSheet
          deal={deal}
          onClose={() => setPassOpen(false)}
        />
      )}
    </>
  );
}
