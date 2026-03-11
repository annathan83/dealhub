"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { BuyerProfile } from "@/lib/kpi/buyerFit";

type Props = {
  initialProfile: BuyerProfile | null;
};

// ─── Tag input ────────────────────────────────────────────────────────────────

function TagInput({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  function addTag(raw: string) {
    const tag = raw.trim();
    if (tag && !value.includes(tag)) {
      onChange([...value, tag]);
    }
    setDraft("");
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-400 mb-2">{hint}</p>}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F0FAF7] border border-[#A3DFD0] text-[#1F7A63] text-xs font-medium rounded-full"
          >
            {tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((t) => t !== tag))}
              className="text-[#1F7A63]/60 hover:text-[#1F7A63] ml-0.5"
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag(draft);
          }
        }}
        onBlur={() => { if (draft.trim()) addTag(draft); }}
        placeholder={placeholder ?? "Type and press Enter"}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30 focus:border-[#1F7A63] bg-white"
      />
    </div>
  );
}

// ─── Number input ─────────────────────────────────────────────────────────────

function NumberField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  prefix,
}: {
  label: string;
  hint?: string;
  value: number | null;
  onChange: (v: number | null) => void;
  placeholder?: string;
  prefix?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-400 mb-2">{hint}</p>}
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">{prefix}</span>
        )}
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) => {
            const n = parseFloat(e.target.value);
            onChange(isNaN(n) ? null : n);
          }}
          placeholder={placeholder}
          className={`w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30 focus:border-[#1F7A63] bg-white ${prefix ? "pl-7" : ""}`}
        />
      </div>
    </div>
  );
}

// ─── Select field ─────────────────────────────────────────────────────────────

function SelectField({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-400 mb-2">{hint}</p>}
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30 focus:border-[#1F7A63] bg-white"
      >
        <option value="">Not specified</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Text area ────────────────────────────────────────────────────────────────

function TextAreaField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (v: string | null) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {hint && <p className="text-xs text-slate-400 mb-2">{hint}</p>}
      <textarea
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        placeholder={placeholder}
        rows={rows ?? 3}
        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F7A63]/30 focus:border-[#1F7A63] bg-white resize-none"
      />
    </div>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-5 pb-3 border-b border-slate-100">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
    </div>
  );
}

// ─── File upload section ──────────────────────────────────────────────────────

function ProfileUploadSection({
  sourceFileName,
  sourceUploadedAt,
  onUploaded,
}: {
  sourceFileName: string | null | undefined;
  sourceUploadedAt: string | null | undefined;
  onUploaded: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/buyer-profile/upload", { method: "POST", body: form });
      const data = await res.json() as { error?: string; source_file_name?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
      setUploadSuccess(data.source_file_name ?? file.name);
      onUploaded();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <SectionHeader
        title="Import from Document"
        description="Upload a PDF or Word doc with your acquisition criteria — AI will extract and fill the fields below automatically."
      />

      {/* Current source file */}
      {(sourceFileName || uploadSuccess) && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-emerald-800 truncate">
              {uploadSuccess ?? sourceFileName}
            </p>
            {sourceUploadedAt && !uploadSuccess && (
              <p className="text-[10px] text-emerald-600">
                Imported {new Date(sourceUploadedAt).toLocaleDateString()}
              </p>
            )}
            {uploadSuccess && (
              <p className="text-[10px] text-emerald-600">Just imported — fields updated below</p>
            )}
          </div>
        </div>
      )}

      {uploadError && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
          {uploadError}
        </p>
      )}

      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-slate-200 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-50 transition-colors text-slate-700"
        >
          {uploading ? (
            <>
              <svg className="w-4 h-4 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Extracting…
            </>
          ) : (
            <>
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {sourceFileName ? "Replace document" : "Upload document"}
            </>
          )}
        </button>
        <p className="text-xs text-slate-400">PDF, Word, or TXT · max 20 MB</p>
      </div>
    </section>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export default function BuyerProfileForm({ initialProfile }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preferredIndustries, setPreferredIndustries] = useState<string[]>(
    initialProfile?.preferred_industries ?? []
  );
  const [excludedIndustries, setExcludedIndustries] = useState<string[]>(
    initialProfile?.excluded_industries ?? []
  );
  const [targetSdeMin, setTargetSdeMin] = useState<number | null>(
    initialProfile?.target_sde_min ?? null
  );
  const [targetSdeMax, setTargetSdeMax] = useState<number | null>(
    initialProfile?.target_sde_max ?? null
  );
  const [targetPriceMin, setTargetPriceMin] = useState<number | null>(
    initialProfile?.target_purchase_price_min ?? null
  );
  const [targetPriceMax, setTargetPriceMax] = useState<number | null>(
    initialProfile?.target_purchase_price_max ?? null
  );
  const [preferredLocations, setPreferredLocations] = useState<string[]>(
    initialProfile?.preferred_locations ?? []
  );
  const [maxEmployees, setMaxEmployees] = useState<number | null>(
    initialProfile?.max_employees ?? null
  );
  const [managerRequired, setManagerRequired] = useState<string | null>(
    initialProfile?.manager_required ?? null
  );
  const [ownerOperatorOk, setOwnerOperatorOk] = useState<string | null>(
    initialProfile?.owner_operator_ok ?? null
  );
  const [businessChars, setBusinessChars] = useState<string | null>(
    initialProfile?.preferred_business_characteristics ?? null
  );
  const [experience, setExperience] = useState<string | null>(
    initialProfile?.experience_background ?? null
  );
  const [goals, setGoals] = useState<string | null>(
    initialProfile?.acquisition_goals ?? null
  );

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const res = await fetch("/api/buyer-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferred_industries: preferredIndustries,
          excluded_industries: excludedIndustries,
          target_sde_min: targetSdeMin,
          target_sde_max: targetSdeMax,
          target_purchase_price_min: targetPriceMin,
          target_purchase_price_max: targetPriceMax,
          preferred_locations: preferredLocations,
          max_employees: maxEmployees,
          manager_required: managerRequired,
          owner_operator_ok: ownerOperatorOk,
          preferred_business_characteristics: businessChars,
          experience_background: experience,
          acquisition_goals: goals,
        }),
      });

      const data = await res.json() as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Failed to save profile.");
        return;
      }

      setSaved(true);
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">

      {/* ── Document import ──────────────────────────────────────────────── */}
      <ProfileUploadSection
        sourceFileName={initialProfile?.profile_source_file_name}
        sourceUploadedAt={initialProfile?.profile_source_uploaded_at}
        onUploaded={() => router.refresh()}
      />

      {/* ── Industry preferences ─────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <SectionHeader
          title="Industry Preferences"
          description="Which industries are you actively looking for? Which do you want to avoid?"
        />
        <div className="space-y-5">
          <TagInput
            label="Preferred Industries"
            hint="Type an industry and press Enter. Examples: Childcare, Home Services, B2B Services"
            value={preferredIndustries}
            onChange={setPreferredIndustries}
            placeholder="e.g. Childcare"
          />
          <TagInput
            label="Excluded Industries"
            hint="Industries you want to skip entirely."
            value={excludedIndustries}
            onChange={setExcludedIndustries}
            placeholder="e.g. Restaurant"
          />
        </div>
      </section>

      {/* ── Financial targets ────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <SectionHeader
          title="Financial Targets"
          description="Your target SDE range and purchase price budget."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <NumberField
            label="Target SDE — Minimum"
            hint="Minimum annual SDE you're looking for"
            value={targetSdeMin}
            onChange={setTargetSdeMin}
            placeholder="e.g. 150000"
            prefix="$"
          />
          <NumberField
            label="Target SDE — Maximum"
            hint="Maximum SDE (leave blank for no limit)"
            value={targetSdeMax}
            onChange={setTargetSdeMax}
            placeholder="e.g. 600000"
            prefix="$"
          />
          <NumberField
            label="Purchase Price — Minimum"
            hint="Optional lower bound on asking price"
            value={targetPriceMin}
            onChange={setTargetPriceMin}
            placeholder="e.g. 500000"
            prefix="$"
          />
          <NumberField
            label="Purchase Price — Maximum"
            hint="Your maximum budget for the acquisition"
            value={targetPriceMax}
            onChange={setTargetPriceMax}
            placeholder="e.g. 2000000"
            prefix="$"
          />
        </div>
      </section>

      {/* ── Location preferences ─────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <SectionHeader
          title="Location Preferences"
          description="Where are you willing to acquire a business?"
        />
        <TagInput
          label="Preferred Locations"
          hint="States, counties, or cities. Type and press Enter."
          value={preferredLocations}
          onChange={setPreferredLocations}
          placeholder="e.g. Florida, Broward County"
        />
      </section>

      {/* ── Operational preferences ──────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <SectionHeader
          title="Operational Preferences"
          description="What kind of business structure works for you?"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <NumberField
            label="Maximum Employees"
            hint="Maximum team size you're comfortable managing"
            value={maxEmployees}
            onChange={setMaxEmployees}
            placeholder="e.g. 25"
          />
          <SelectField
            label="Manager in Place"
            hint="Do you need a manager already in place?"
            value={managerRequired}
            onChange={setManagerRequired}
            options={[
              { value: "yes",    label: "Yes — required" },
              { value: "prefer", label: "Prefer but not required" },
              { value: "no",     label: "No preference" },
            ]}
          />
          <SelectField
            label="Owner-Operator Model"
            hint="Are you willing to work in the business full-time?"
            value={ownerOperatorOk}
            onChange={setOwnerOperatorOk}
            options={[
              { value: "yes",    label: "Yes — I plan to operate" },
              { value: "prefer", label: "Prefer semi-absentee" },
              { value: "no",     label: "No — looking for passive/managed" },
            ]}
          />
        </div>
      </section>

      {/* ── Context ──────────────────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <SectionHeader
          title="Background & Goals"
          description="Optional context that helps personalize your Buyer Fit analysis."
        />
        <div className="space-y-5">
          <TextAreaField
            label="Preferred Business Characteristics"
            hint="What kinds of businesses appeal to you? (e.g. recurring revenue, low CapEx, strong team)"
            value={businessChars}
            onChange={setBusinessChars}
            placeholder="e.g. Recurring revenue model, established team, low owner dependence"
            rows={2}
          />
          <TextAreaField
            label="Experience Background"
            hint="Relevant experience that affects what you can manage"
            value={experience}
            onChange={setExperience}
            placeholder="e.g. 10 years in operations management, background in healthcare"
            rows={2}
          />
          <TextAreaField
            label="Acquisition Goals"
            hint="What are you trying to achieve with this acquisition?"
            value={goals}
            onChange={setGoals}
            placeholder="e.g. Replace income, build a portfolio, semi-passive investment"
            rows={2}
          />
        </div>
      </section>

      {/* ── Save button ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
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
          ) : "Save Profile"}
        </button>

        {saved && (
          <span className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Profile saved
          </span>
        )}

        {error && (
          <span className="text-sm text-red-500">{error}</span>
        )}
      </div>

    </div>
  );
}
