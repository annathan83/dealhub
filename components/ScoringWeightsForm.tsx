"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// The 6 standard KPIs — mirrors KPI_DEFINITIONS in lib/kpi/kpiConfig.ts
const DEFAULT_KPIS = [
  {
    key: "price_multiple",
    label: "Purchase Multiple",
    description: "Asking price ÷ SDE — core valuation check",
    defaultWeight: 30,
  },
  {
    key: "earnings_margin",
    label: "SDE Margin",
    description: "SDE as % of revenue — profitability quality",
    defaultWeight: 20,
  },
  {
    key: "revenue_per_employee",
    label: "Revenue / Employee",
    description: "Annual revenue per FTE — labor efficiency",
    defaultWeight: 15,
  },
  {
    key: "owner_dependence",
    label: "Owner Dependence",
    description: "Transition risk from owner reliance",
    defaultWeight: 15,
  },
  {
    key: "rent_ratio",
    label: "Rent Ratio",
    description: "Annual rent as % of revenue — fixed-cost exposure",
    defaultWeight: 10,
  },
  {
    key: "revenue_quality",
    label: "Revenue Quality",
    description: "Recurring revenue % and customer concentration",
    defaultWeight: 10,
  },
];

type Props = {
  initialConfig: Record<string, number> | null;
};

export default function ScoringWeightsForm({ initialConfig }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize weights from saved config (stored as 0–1 fractions) or defaults
  const [weights, setWeights] = useState<Record<string, string>>(() => {
    if (initialConfig && Object.keys(initialConfig).length > 0) {
      const result: Record<string, string> = {};
      for (const kpi of DEFAULT_KPIS) {
        const saved = initialConfig[kpi.key];
        result[kpi.key] = saved != null
          ? String(Math.round(saved * 100))
          : String(kpi.defaultWeight);
      }
      return result;
    }
    const result: Record<string, string> = {};
    for (const kpi of DEFAULT_KPIS) {
      result[kpi.key] = String(kpi.defaultWeight);
    }
    return result;
  });

  // Compute total and normalized percentages for display
  const total = DEFAULT_KPIS.reduce((sum, kpi) => {
    return sum + (parseFloat(weights[kpi.key] ?? "0") || 0);
  }, 0);

  function getNormalized(key: string): number {
    const raw = parseFloat(weights[key] ?? "0") || 0;
    return total > 0 ? Math.round((raw / total) * 100) : 0;
  }

  const isBalanced = Math.abs(total - 100) < 0.5;

  function handleChange(key: string, value: string) {
    setSaved(false);
    setWeights((prev) => ({ ...prev, [key]: value }));
  }

  function resetToDefaults() {
    const defaults: Record<string, string> = {};
    for (const kpi of DEFAULT_KPIS) {
      defaults[kpi.key] = String(kpi.defaultWeight);
    }
    setWeights(defaults);
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    // Build config as raw numbers (API will normalize)
    const config: Record<string, number> = {};
    for (const kpi of DEFAULT_KPIS) {
      const raw = parseFloat(weights[kpi.key] ?? "0") || 0;
      if (raw > 0) config[kpi.key] = raw;
    }

    if (Object.keys(config).length === 0) {
      setError("At least one KPI must have a weight greater than 0.");
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/settings/scoring-config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_scoring_config: config }),
      });
      const data = await res.json() as { error?: string; default_scoring_config?: Record<string, number> };
      if (!res.ok) {
        setError(data.error ?? "Failed to save.");
        return;
      }
      setSaved(true);
      startTransition(() => router.refresh());
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">

      {/* ── KPI weights card ─────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Default KPI Weights</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Adjust how much each metric contributes to the overall deal score.
            </p>
          </div>
          <button
            type="button"
            onClick={resetToDefaults}
            className="text-xs text-slate-400 hover:text-slate-600 font-medium transition-colors"
          >
            Reset to defaults
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {DEFAULT_KPIS.map((kpi) => {
            const raw = parseFloat(weights[kpi.key] ?? "0") || 0;
            const normalized = getNormalized(kpi.key);
            const barWidth = Math.min(100, normalized);

            return (
              <div key={kpi.key} className="px-6 py-4">
                <div className="flex items-start gap-4">
                  {/* Label + description */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{kpi.label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{kpi.description}</p>
                  </div>

                  {/* Weight input */}
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="1"
                      value={weights[kpi.key] ?? ""}
                      onChange={(e) => handleChange(kpi.key, e.target.value)}
                      className="w-16 text-right text-sm font-semibold text-slate-700 border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30 focus:border-[#1F7A63] transition"
                    />
                    <span className="text-xs text-slate-400 w-4">%</span>
                  </div>
                </div>

                {/* Weight bar */}
                <div className="mt-2.5 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1F7A63] rounded-full transition-all duration-200"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>

                {/* Normalized % label */}
                <div className="flex justify-end mt-1">
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {normalized}% of score
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Total indicator */}
        <div className={`px-6 py-3 border-t flex items-center justify-between ${
          isBalanced ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"
        }`}>
          <span className={`text-xs font-medium ${isBalanced ? "text-emerald-700" : "text-amber-700"}`}>
            {isBalanced
              ? "Weights sum to 100% — balanced"
              : `Total: ${Math.round(total)}% — weights will be normalized automatically`}
          </span>
          <span className={`text-xs font-bold tabular-nums ${isBalanced ? "text-emerald-700" : "text-amber-700"}`}>
            {Math.round(total)}%
          </span>
        </div>
      </section>

      {/* ── Info card ────────────────────────────────────────────────────── */}
      <div className="bg-slate-50 rounded-xl border border-slate-200 px-5 py-4">
        <p className="text-xs text-slate-500 leading-relaxed">
          <span className="font-semibold text-slate-700">How this works:</span> These weights set the default scoring model for all new deals. Weights don&apos;t need to sum to exactly 100 — they&apos;re normalized automatically. You can also override weights per-deal in the <span className="font-medium">Facts tab → Scoring Weights</span> section.
        </p>
      </div>

      {/* ── Save button ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1F7A63] text-white text-sm font-semibold rounded-lg hover:bg-[#1a6854] disabled:opacity-50 transition-colors shadow-sm"
        >
          {saving ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Saving…
            </>
          ) : "Save Defaults"}
        </button>

        {saved && (
          <span className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Defaults saved
          </span>
        )}

        {error && (
          <span className="text-sm text-red-500">{error}</span>
        )}
      </div>

    </div>
  );
}
