"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Deal, PassReason } from "@/types";
import { getDealDisplayName } from "@/types";

const PASS_REASONS: { value: PassReason; label: string }[] = [
  { value: "price_too_high",          label: "Price too high" },
  { value: "financials_dont_work",    label: "Financials don't work" },
  { value: "wrong_industry",          label: "Wrong industry" },
  { value: "wrong_location",          label: "Wrong location" },
  { value: "owner_dependent",         label: "Too owner-dependent" },
  { value: "customer_concentration",  label: "Customer concentration risk" },
  { value: "not_enough_info",         label: "Not enough information" },
  { value: "other",                   label: "Other" },
];

type Props = {
  deal: Deal;
  onClose: () => void;
};

export default function PassDecisionSheet({ deal, onClose }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState<PassReason | "">("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState<"archive" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleArchive() {
    setLoading("archive");
    setError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pass",
          pass_reason: reason || null,
          pass_note: note.trim() || null,
          delete_deal: false,
        }),
      });
      if (!res.ok) throw new Error("Failed to archive deal");
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setLoading("delete");
    setError(null);
    try {
      const res = await fetch(`/api/deals/${deal.id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "pass",
          delete_deal: true,
        }),
      });
      if (!res.ok) throw new Error("Failed to delete deal");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(null);
    }
  }

  const isLoading = loading !== null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet — slides up from bottom on mobile, centered modal on desktop */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pass on this deal"
        className="fixed z-50 inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-4"
      >
        <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden">

          {/* Handle (mobile) */}
          <div className="flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-slate-200" />
          </div>

          {/* Header */}
          <div className="px-5 pt-4 pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
                  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Pass on this deal</h2>
                  <p className="text-xs text-slate-400 truncate max-w-[200px]">{getDealDisplayName(deal)}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={isLoading}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors disabled:opacity-40"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">

            {/* Reason selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Reason <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {PASS_REASONS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setReason(reason === value ? "" : value)}
                    disabled={isLoading}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                      reason === value
                        ? "bg-red-600 text-white border-red-600"
                        : "bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:text-red-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Note <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                disabled={isLoading}
                placeholder="Any additional context for why you're passing…"
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none disabled:opacity-60"
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}
          </div>

          {/* Actions */}
          <div className="px-5 pb-6 space-y-2.5">

            {/* Archive as Passed — primary action */}
            <button
              onClick={handleArchive}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3.5 text-sm font-semibold text-white hover:bg-red-700 active:scale-[0.99] disabled:opacity-60 transition-all shadow-sm"
              style={{ minHeight: 52 }}
            >
              {loading === "archive" ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
              )}
              Archive as Passed
            </button>

            {/* Delete — destructive, requires confirmation */}
            <button
              onClick={handleDelete}
              disabled={isLoading}
              className={`w-full flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all active:scale-[0.99] disabled:opacity-60 ${
                confirmDelete
                  ? "bg-slate-900 text-white border-slate-900 hover:bg-slate-800"
                  : "bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700"
              }`}
              style={{ minHeight: 48 }}
            >
              {loading === "delete" ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              )}
              {confirmDelete ? "Confirm — permanently delete" : "Delete deal permanently"}
            </button>

            {confirmDelete && (
              <p className="text-xs text-slate-500 text-center">
                This will permanently delete the deal and all associated data. This cannot be undone.
              </p>
            )}

            {/* Cancel */}
            <button
              onClick={() => { setConfirmDelete(false); onClose(); }}
              disabled={isLoading}
              className="w-full py-2.5 text-sm text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
