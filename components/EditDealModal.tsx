"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Deal, DealStatus } from "@/types";

const STATUS_OPTIONS: { value: DealStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "due_diligence", label: "Due Diligence" },
  { value: "offer", label: "Offer" },
  { value: "closed", label: "Closed" },
  { value: "passed", label: "Passed" },
];

type Props = {
  deal: Deal;
  onClose: () => void;
};

type FormState = {
  name: string;
  description: string;
  industry: string;
  location: string;
  status: DealStatus;
  asking_price: string;
  sde: string;
};

/** Parse a money/number string like "$1.2M", "1200000", "240K" → number or null */
function parseMoney(raw: string): number | null {
  const s = raw.trim().replace(/[$,\s]/g, "").toUpperCase();
  if (!s) return null;
  const multiplier = s.endsWith("M") ? 1_000_000 : s.endsWith("K") ? 1_000 : 1;
  const num = parseFloat(s.replace(/[MK]$/, ""));
  return isNaN(num) ? null : num * multiplier;
}

/** Compute multiple from asking price and SDE strings. Returns e.g. "5.0x" or null. */
export function computeMultiple(asking_price: string, sde: string): string | null {
  const price = parseMoney(asking_price);
  const sdeVal = parseMoney(sde);
  if (!price || !sdeVal || sdeVal === 0) return null;
  return `${(price / sdeVal).toFixed(1)}x`;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
        {label}
        {hint && <span className="ml-1.5 font-normal normal-case text-slate-400">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition disabled:opacity-60";

export default function EditDealModal({ deal, onClose }: Props) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);

  const [form, setForm] = useState<FormState>({
    name: deal.name,
    description: deal.description ?? "",
    industry: deal.industry ?? "",
    location: deal.location ?? "",
    status: deal.status,
    asking_price: deal.asking_price ?? "",
    sde: deal.sde ?? "",
  });

  const computedMultiple = computeMultiple(form.asking_price, form.sde);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Deal name is required.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          industry: form.industry,
          location: form.location,
          status: form.status,
          asking_price: form.asking_price,
          sde: form.sde,
          // multiple is always server-computed — not sent by client
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Failed to save changes.");
      }

      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    /* Overlay */
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Modal */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Edit Deal</h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[320px]">{deal.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Deal Name */}
          <Field label="Deal Name">
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              disabled={loading}
              className={INPUT}
              placeholder="e.g. Midwest HVAC Company"
            />
          </Field>

          {/* Status */}
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => set("status", e.target.value)}
              disabled={loading}
              className={INPUT}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>

          {/* Financials row */}
          <div className="grid grid-cols-3 gap-3">
            <Field label="Asking Price" hint="(optional)">
              <input
                type="text"
                value={form.asking_price}
                onChange={(e) => set("asking_price", e.target.value)}
                disabled={loading}
                className={INPUT}
                placeholder="$1.2M"
              />
            </Field>
            <Field label="SDE" hint="(optional)">
              <input
                type="text"
                value={form.sde}
                onChange={(e) => set("sde", e.target.value)}
                disabled={loading}
                className={INPUT}
                placeholder="$240K"
              />
            </Field>
            <Field label="Multiple">
              <div className={`${INPUT} flex items-center justify-between bg-slate-100 border-slate-200 cursor-default`}>
                <span className={computedMultiple ? "font-semibold text-slate-800" : "text-slate-400"}>
                  {computedMultiple ?? "—"}
                </span>
                {computedMultiple && (
                  <span className="text-xs text-slate-400">auto</span>
                )}
              </div>
            </Field>
          </div>
          {!computedMultiple && (form.asking_price || form.sde) && (
            <p className="text-xs text-slate-400 -mt-2">
              Enter both Asking Price and SDE to calculate the multiple automatically.
            </p>
          )}

          {/* Industry + Location */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Industry" hint="(optional)">
              <input
                type="text"
                value={form.industry}
                onChange={(e) => set("industry", e.target.value)}
                disabled={loading}
                className={INPUT}
                placeholder="e.g. HVAC"
              />
            </Field>
            <Field label="Location" hint="(optional)">
              <input
                type="text"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                disabled={loading}
                className={INPUT}
                placeholder="e.g. Denver, CO"
              />
            </Field>
          </div>

          {/* Description */}
          <Field label="Description" hint="(optional)">
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              disabled={loading}
              className={`${INPUT} resize-none`}
              placeholder="Brief overview of the opportunity…"
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Saving…
              </>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
