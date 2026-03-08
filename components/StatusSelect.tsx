"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DealStatus } from "@/types";

const STATUS_OPTIONS: { value: DealStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "due_diligence", label: "Due Diligence" },
  { value: "offer", label: "Offer" },
  { value: "closed", label: "Closed" },
  { value: "passed", label: "Passed" },
];

const STATUS_STYLES: Record<DealStatus, string> = {
  new: "bg-slate-100 text-slate-600 border-slate-200 hover:border-slate-300",
  reviewing: "bg-blue-50 text-blue-700 border-blue-100 hover:border-blue-300",
  due_diligence: "bg-purple-50 text-purple-700 border-purple-100 hover:border-purple-300",
  offer: "bg-indigo-50 text-indigo-700 border-indigo-100 hover:border-indigo-300",
  closed: "bg-green-50 text-green-700 border-green-100 hover:border-green-300",
  passed: "bg-red-50 text-red-600 border-red-100 hover:border-red-300",
};

type Props = {
  dealId: string;
  currentStatus: DealStatus;
  /** "badge" = compact pill style (deal page header), "row" = table row style */
  variant?: "badge" | "row";
};

export default function StatusSelect({ dealId, currentStatus, variant = "badge" }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<DealStatus>(currentStatus);
  const [isPending, startTransition] = useTransition();

  async function handleChange(next: DealStatus) {
    if (next === status) return;
    const prev = status;
    setStatus(next); // optimistic update

    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("Failed");
      startTransition(() => router.refresh());
    } catch {
      setStatus(prev); // revert on error
    }
  }

  const style = STATUS_STYLES[status] ?? STATUS_STYLES.new;

  if (variant === "badge") {
    return (
      <div className="relative inline-flex">
        <select
          value={status}
          onChange={(e) => handleChange(e.target.value as DealStatus)}
          disabled={isPending}
          onClick={(e) => e.stopPropagation()}
          className={`appearance-none cursor-pointer rounded-full border pl-2.5 pr-6 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-300 disabled:opacity-60 ${style}`}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        {/* Chevron */}
        <svg
          className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 opacity-60"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    );
  }

  // "row" variant — compact pill inside the table, stops row click propagation
  return (
    <div className="relative inline-flex">
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value as DealStatus)}
        disabled={isPending}
        onClick={(e) => e.stopPropagation()}
        className={`appearance-none cursor-pointer rounded-full border pl-2 pr-5 py-px text-[11px] font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-indigo-300 disabled:opacity-50 ${style}`}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 opacity-50"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
