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

const STATUS_COLORS: Record<DealStatus, string> = {
  new: "bg-slate-100 text-slate-600",
  reviewing: "bg-blue-50 text-blue-700",
  due_diligence: "bg-purple-50 text-purple-700",
  offer: "bg-indigo-50 text-indigo-700",
  closed: "bg-green-50 text-green-700",
  passed: "bg-red-50 text-red-600",
};

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

/** Parse a money/number string like "$1.2M", "1,200,000", "240K" → number or null */
function parseMoney(raw: string): number | null {
  const s = raw.trim().replace(/[$,\s]/g, "").toUpperCase();
  if (!s) return null;
  const multiplier = s.endsWith("M") ? 1_000_000 : s.endsWith("K") ? 1_000 : 1;
  const num = parseFloat(s.replace(/[MK]$/, ""));
  return isNaN(num) ? null : num * multiplier;
}

/** Format a raw money string into a display value with $ and commas */
function formatMoney(raw: string): string {
  const num = parseMoney(raw);
  if (num === null) return raw;
  return "$" + num.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

/** Compute multiple from asking price and SDE strings. Returns e.g. "5.0x" or null. */
export function computeMultiple(asking_price: string, sde: string): string | null {
  const price = parseMoney(asking_price);
  const sdeVal = parseMoney(sde);
  if (!price || !sdeVal || sdeVal === 0) return null;
  return `${(price / sdeVal).toFixed(1)}x`;
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {description && <p className="text-xs text-slate-400 mt-0.5">{description}</p>}
    </div>
  );
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-slate-700">{label}</label>
        {optional && (
          <span className="text-xs text-slate-400 font-normal">Optional</span>
        )}
      </div>
      {children}
    </div>
  );
}

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 h-11 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition disabled:opacity-60 disabled:bg-slate-50";

const SELECT =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 h-11 text-sm text-slate-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition disabled:opacity-60 appearance-none cursor-pointer";

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

  // Track which currency fields are focused to show raw vs formatted
  const [focusedField, setFocusedField] = useState<"asking_price" | "sde" | null>(null);

  const computedMultiple = computeMultiple(form.asking_price, form.sde);

  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/deals/${deal.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? "Failed to delete deal.");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setDeleting(false);
      setConfirmDelete(false);
    }
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
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      {/* Modal */}
        <div className="relative w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl border border-slate-100 flex flex-col max-h-[92dvh] sm:max-h-[90dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 shrink-0">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Edit Deal</h2>
            <p className="text-xs text-slate-400 mt-0.5 truncate max-w-[280px]">{deal.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-6 flex flex-col gap-8">

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-lg bg-red-50 border border-red-100 px-4 py-3">
              <svg className="w-4 h-4 text-red-500 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* ── Section: Basic ─────────────────────────────── */}
          <div>
            <SectionHeader title="Basic" description="Deal name and current pipeline status" />
            <div className="flex flex-col gap-4">
              <Field label="Deal name">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  disabled={loading}
                  className={INPUT}
                  placeholder="e.g. Midwest HVAC Company"
                  autoFocus
                />
              </Field>

              <Field label="Status">
                <div className="relative">
                  <select
                    value={form.status}
                    onChange={(e) => set("status", e.target.value as DealStatus)}
                    disabled={loading}
                    className={`${SELECT} pl-9`}
                  >
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  {/* Status color dot */}
                  <span className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${STATUS_COLORS[form.status]}`} />
                  {/* Chevron */}
                  <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </Field>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* ── Section: Financials ────────────────────────── */}
          <div>
            <SectionHeader title="Financials" description="Key deal metrics — enter values like $1.2M or 240000" />
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Asking price" optional>
                  <input
                    type="text"
                    value={focusedField === "asking_price" ? form.asking_price : (form.asking_price ? formatMoney(form.asking_price) : "")}
                    onChange={(e) => set("asking_price", e.target.value)}
                    onFocus={() => setFocusedField("asking_price")}
                    onBlur={() => setFocusedField(null)}
                    disabled={loading}
                    className={INPUT}
                    placeholder="$1,200,000"
                  />
                </Field>
                <Field label="SDE" optional>
                  <input
                    type="text"
                    value={focusedField === "sde" ? form.sde : (form.sde ? formatMoney(form.sde) : "")}
                    onChange={(e) => set("sde", e.target.value)}
                    onFocus={() => setFocusedField("sde")}
                    onBlur={() => setFocusedField(null)}
                    disabled={loading}
                    className={INPUT}
                    placeholder="$240,000"
                  />
                </Field>
              </div>

              {/* Multiple — auto-computed */}
              <Field label="Multiple">
                <div className={`w-full rounded-lg border h-11 px-3.5 flex items-center justify-between ${computedMultiple ? "border-slate-200 bg-slate-50" : "border-dashed border-slate-200 bg-slate-50/50"}`}>
                  <span className={`text-sm font-semibold tabular-nums ${computedMultiple ? "text-slate-800" : "text-slate-400"}`}>
                    {computedMultiple ?? "—"}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    {computedMultiple ? "auto-calculated" : "enter price + SDE"}
                  </span>
                </div>
              </Field>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* ── Section: Details ──────────────────────────── */}
          <div>
            <SectionHeader title="Details" description="Additional context about the business" />
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Industry" optional>
                  <input
                    type="text"
                    value={form.industry}
                    onChange={(e) => set("industry", e.target.value)}
                    disabled={loading}
                    className={INPUT}
                    placeholder="e.g. HVAC, Retail"
                  />
                </Field>
                <Field label="Location" optional>
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

              <Field label="Description" optional>
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  disabled={loading}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition disabled:opacity-60 resize-none"
                  placeholder="Brief overview of the opportunity…"
                />
              </Field>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 px-6 py-4 border-t border-slate-100 shrink-0 bg-slate-50/60">
          {/* Delete — left side */}
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={loading || deleting}
              className="sm:mr-auto w-full sm:w-auto px-4 h-11 rounded-lg text-sm font-medium text-red-500 border border-red-100 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors disabled:opacity-40"
            >
              Delete deal
            </button>
          ) : (
            <div className="sm:mr-auto flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-red-600 font-medium">Delete forever?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 h-8 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {deleting ? "Deleting…" : "Yes, delete"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="px-3 h-8 rounded-lg text-xs font-medium text-slate-500 border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Cancel + Save — right side */}
          <button
            type="button"
            onClick={onClose}
            disabled={loading || deleting}
            className="w-full sm:w-auto px-5 h-11 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-50 hover:text-slate-900 transition-colors disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading || deleting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 h-11 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Saving…
              </>
            ) : (
              "Save changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
