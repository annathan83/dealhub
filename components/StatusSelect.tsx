"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DealStatus } from "@/types";

const STATUS_OPTIONS: { value: DealStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "closed", label: "Closed" },
  { value: "passed", label: "Passed" },
];

const STATUS_STYLES: Record<DealStatus, string> = {
  active: "bg-indigo-50 text-indigo-700 border-indigo-100 hover:border-indigo-300",
  closed: "bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-300",
  passed: "bg-slate-100 text-slate-500 border-slate-200 hover:border-slate-300",
};

type Props = {
  dealId: string;
  currentStatus: DealStatus;
  variant?: "badge" | "row";
};

export default function StatusSelect({ dealId, currentStatus, variant = "badge" }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<DealStatus>(currentStatus);
  const [isPending, startTransition] = useTransition();

  async function handleChange(next: DealStatus) {
    if (next === status) return;
    const prev = status;
    setStatus(next);
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error("Failed");
      startTransition(() => router.refresh());
    } catch {
      setStatus(prev);
    }
  }

  const style = STATUS_STYLES[status] ?? STATUS_STYLES.active;
  const sizeClass = variant === "row"
    ? "pl-2 pr-5 py-px text-[11px] font-medium"
    : "pl-2.5 pr-6 py-0.5 text-xs font-semibold";

  return (
    <div className="relative inline-flex">
      <select
        value={status}
        onChange={(e) => handleChange(e.target.value as DealStatus)}
        disabled={isPending}
        onClick={(e) => e.stopPropagation()}
        className={`appearance-none cursor-pointer rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-indigo-300 disabled:opacity-60 ${sizeClass} ${style}`}
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 opacity-50"
        fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
