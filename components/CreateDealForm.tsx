"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { DealStatus } from "@/types";
import Link from "next/link";

const STATUS_OPTIONS: { value: DealStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "reviewing", label: "Reviewing" },
  { value: "due_diligence", label: "Due Diligence" },
  { value: "offer", label: "Offer" },
  { value: "closed", label: "Closed" },
  { value: "passed", label: "Passed" },
];

export default function CreateDealForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [initialNotes, setInitialNotes] = useState("");
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [status, setStatus] = useState<DealStatus>("new");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Creating…");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Deal name is required.");
      return;
    }
    setError(null);
    setLoading(true);
    setLoadingLabel("Creating deal…");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("You must be signed in to create a deal.");
      setLoading(false);
      return;
    }

    // ── 1. Create the deal ────────────────────────────────────────────────────
    const { data, error: insertError } = await supabase
      .from("deals")
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: null,
        industry: industry.trim() || null,
        location: location.trim() || null,
        status,
      })
      .select("id, name")
      .single();

    if (insertError || !data) {
      setError(insertError?.message ?? "Failed to create deal. Please try again.");
      setLoading(false);
      return;
    }

    const dealId = data.id as string;

    // ── 2. If initial notes were provided, submit them as a first entry ───────
    // This triggers Drive save + AI analysis via the existing entries API.
    if (initialNotes.trim()) {
      setLoadingLabel("Analyzing notes…");
      try {
        const res = await fetch(`/api/deals/${dealId}/entries`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: initialNotes.trim() }),
        });
        if (!res.ok) {
          // Non-fatal — deal was created, just skip the entry
          console.warn("Initial entry submission failed:", await res.text());
        }
      } catch (err) {
        // Non-fatal
        console.warn("Initial entry submission error:", err);
      }
    }

    router.push(`/deals/${dealId}`);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Deal Name */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-slate-700">
          Deal Name <span className="text-red-500">*</span>
        </label>
        <input
          id="name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Midwest HVAC Company"
          disabled={loading}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition disabled:opacity-60"
        />
      </div>

      {/* Industry + Location row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="industry" className="text-sm font-medium text-slate-700">
            Industry <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="industry"
            type="text"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            placeholder="e.g. HVAC, SaaS, Retail"
            disabled={loading}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition disabled:opacity-60"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="location" className="text-sm font-medium text-slate-700">
            Location <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <input
            id="location"
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Denver, CO"
            disabled={loading}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition disabled:opacity-60"
          />
        </div>
      </div>

      {/* Status */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="status" className="text-sm font-medium text-slate-700">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as DealStatus)}
          disabled={loading}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition disabled:opacity-60"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Initial Notes */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="initialNotes" className="text-sm font-medium text-slate-700">
          Initial Notes{" "}
          <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <p className="text-xs text-slate-400">
          Paste a listing, broker email, or any raw notes. AI will analyze and save them automatically.
        </p>
        <textarea
          id="initialNotes"
          rows={6}
          value={initialNotes}
          onChange={(e) => setInitialNotes(e.target.value)}
          placeholder="Paste listing text, broker emails, financial details, or your own notes…"
          disabled={loading}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition resize-y disabled:opacity-60"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm shadow-indigo-200"
        >
          {loading ? (
            <>
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
              {loadingLabel}
            </>
          ) : (
            "Create Deal"
          )}
        </button>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
