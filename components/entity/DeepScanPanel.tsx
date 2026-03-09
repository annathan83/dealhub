"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Entity, DeepScanStatus } from "@/types/entity";

type Props = {
  entity: Entity;
  dealId: string;
};

function formatDate(iso: string | null): string {
  if (!iso) return "Never";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_CONFIG: Record<NonNullable<DeepScanStatus>, { label: string; classes: string; dot: string }> = {
  not_run:   { label: "Not run",   classes: "bg-slate-50 text-slate-500 border-slate-200",   dot: "bg-slate-300"   },
  running:   { label: "Running…",  classes: "bg-blue-50 text-blue-600 border-blue-200",       dot: "bg-blue-400 animate-pulse" },
  completed: { label: "Completed", classes: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  failed:    { label: "Failed",    classes: "bg-red-50 text-red-600 border-red-200",           dot: "bg-red-500"     },
};

export default function DeepScanPanel({ entity, dealId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<{
    facts_inserted: number;
    facts_updated: number;
    conflicts_found: number;
  } | null>(null);

  const scanStatus: DeepScanStatus = entity.deep_scan_status ?? "not_run";
  const statusCfg = STATUS_CONFIG[scanStatus];

  async function runDeepScan() {
    setError(null);
    setLastResult(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/deals/${dealId}/deep-scan`, { method: "POST" });
        const data = await res.json() as {
          success?: boolean;
          error?: string;
          facts_inserted?: number;
          facts_updated?: number;
          conflicts_found?: number;
        };

        if (!res.ok || data.error) {
          setError(data.error ?? "Deep scan failed.");
          return;
        }

        setLastResult({
          facts_inserted: data.facts_inserted ?? 0,
          facts_updated: data.facts_updated ?? 0,
          conflicts_found: data.conflicts_found ?? 0,
        });

        // Refresh page data to show updated facts and KPI
        router.refresh();
      } catch {
        setError("Network error. Please try again.");
      }
    });
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="text-sm font-semibold text-slate-700">Deep Scan</span>
          </div>

          {/* Status pill */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${statusCfg.classes}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-1.5">
          Extracts the full set of supported facts from all stored documents.
          Faster than re-uploading — uses already-extracted text.
        </p>
      </div>

      <div className="px-5 py-4">
        {/* Last scan stats */}
        {(entity.deep_scan_completed_at || lastResult) && (
          <div className="mb-4 grid grid-cols-3 gap-3 text-center">
            <div className="bg-slate-50 rounded-lg py-2">
              <div className="text-base font-bold text-slate-800">
                {lastResult?.facts_inserted ?? entity.deep_scan_facts_added ?? 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Facts added</div>
            </div>
            <div className="bg-slate-50 rounded-lg py-2">
              <div className="text-base font-bold text-slate-800">
                {lastResult?.facts_updated ?? entity.deep_scan_facts_updated ?? 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Updated</div>
            </div>
            <div className={`rounded-lg py-2 ${(lastResult?.conflicts_found ?? entity.deep_scan_conflicts_found ?? 0) > 0 ? "bg-red-50" : "bg-slate-50"}`}>
              <div className={`text-base font-bold ${(lastResult?.conflicts_found ?? entity.deep_scan_conflicts_found ?? 0) > 0 ? "text-red-600" : "text-slate-800"}`}>
                {lastResult?.conflicts_found ?? entity.deep_scan_conflicts_found ?? 0}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Conflicts</div>
            </div>
          </div>
        )}

        {/* Last run time */}
        {entity.deep_scan_completed_at && !lastResult && (
          <div className="mb-3 text-xs text-slate-400">
            Last scan: {formatDate(entity.deep_scan_completed_at)}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
            {error}
          </div>
        )}

        {/* Success message */}
        {lastResult && (
          <div className="mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
            Scan complete. Facts tab and KPI scores have been updated.
          </div>
        )}

        {/* Trigger button */}
        <button
          onClick={runDeepScan}
          disabled={isPending || scanStatus === "running"}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isPending ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Scanning…
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {scanStatus === "completed" ? "Re-run Deep Scan" : "Run Deep Scan"}
            </>
          )}
        </button>

        <p className="mt-2 text-[10px] text-slate-400 text-center">
          Manual fact overrides are preserved. Only missing or unclear facts are updated.
        </p>
      </div>
    </div>
  );
}
