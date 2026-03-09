"use client";

/**
 * DealMetadataFields
 * Shared form controls for structured deal metadata:
 *   - Deal Source (category + detail)
 *   - Industry (category → industry dependent dropdown)
 *   - Location (state → county → city dependent dropdowns)
 *
 * Designed to work inside both CreateDealForm and EditDealModal.
 */

import {
  DEAL_SOURCE_CATEGORIES,
  DEAL_SOURCE_DETAIL_SUGGESTIONS,
  INDUSTRY_CATEGORIES,
  US_STATES,
  getCountiesForState,
  getCitiesForCounty,
  getIndustriesForCategory,
  type DealSourceCategory,
  type IndustryCategory,
} from "@/lib/config/dealMetadata";

// ─── Shared styles ────────────────────────────────────────────────────────────

const BASE =
  "w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition disabled:opacity-60 disabled:bg-slate-50";

const INPUT_H = `${BASE} h-11`;
const SELECT_H = `${BASE} h-11 appearance-none cursor-pointer pr-9`;
const SELECT_DISABLED = `${BASE} h-11 appearance-none cursor-not-allowed pr-9 text-slate-400 bg-slate-50`;

// ─── Sub-components ───────────────────────────────────────────────────────────

function FieldLabel({
  label,
  optional,
  htmlFor,
}: {
  label: string;
  optional?: boolean;
  htmlFor?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 mb-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      {optional && <span className="text-xs text-slate-400">Optional</span>}
    </div>
  );
}

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <svg
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DealMetadataValues {
  deal_source_category: string;
  deal_source_detail: string;
  industry_category: string;
  industry: string;
  state: string;
  county: string;
  city: string;
}

interface Props {
  values: DealMetadataValues;
  onChange: (field: keyof DealMetadataValues, value: string) => void;
  disabled?: boolean;
  /** Compact mode: smaller gaps, used in create form */
  compact?: boolean;
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DealMetadataFields({ values, onChange, disabled, compact }: Props) {
  const gap = compact ? "gap-4" : "gap-5";

  const counties = values.state ? getCountiesForState(values.state) : [];
  const cities = values.state && values.county ? getCitiesForCounty(values.state, values.county) : [];
  const industries = values.industry_category ? getIndustriesForCategory(values.industry_category) : [];
  const sourceDetailSuggestions = values.deal_source_category
    ? (DEAL_SOURCE_DETAIL_SUGGESTIONS[values.deal_source_category as DealSourceCategory] ?? [])
    : [];

  function handleStateChange(val: string) {
    onChange("state", val);
    onChange("county", "");
    onChange("city", "");
  }

  function handleCountyChange(val: string) {
    onChange("county", val);
    onChange("city", "");
  }

  function handleIndustryCategoryChange(val: string) {
    onChange("industry_category", val);
    onChange("industry", "");
  }

  function handleSourceCategoryChange(val: string) {
    onChange("deal_source_category", val);
    onChange("deal_source_detail", "");
  }

  return (
    <div className={`flex flex-col ${gap}`}>

      {/* ── Deal Source ──────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Deal Source
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* Source category */}
          <div>
            <FieldLabel label="Source" optional htmlFor="deal_source_category" />
            <SelectWrapper>
              <select
                id="deal_source_category"
                value={values.deal_source_category}
                onChange={(e) => handleSourceCategoryChange(e.target.value)}
                disabled={disabled}
                className={SELECT_H}
              >
                <option value="">Select source</option>
                {DEAL_SOURCE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </SelectWrapper>
          </div>

          {/* Source detail */}
          <div>
            <FieldLabel label="Source detail" optional htmlFor="deal_source_detail" />
            {sourceDetailSuggestions.length > 0 ? (
              <SelectWrapper>
                <select
                  id="deal_source_detail"
                  value={values.deal_source_detail}
                  onChange={(e) => onChange("deal_source_detail", e.target.value)}
                  disabled={disabled || !values.deal_source_category}
                  className={values.deal_source_category ? SELECT_H : SELECT_DISABLED}
                >
                  <option value="">Select detail</option>
                  {sourceDetailSuggestions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </SelectWrapper>
            ) : (
              <input
                id="deal_source_detail"
                type="text"
                value={values.deal_source_detail}
                onChange={(e) => onChange("deal_source_detail", e.target.value)}
                disabled={disabled || !values.deal_source_category}
                placeholder={values.deal_source_category ? "e.g. broker name, platform…" : "Select source first"}
                className={INPUT_H}
              />
            )}
          </div>

        </div>
      </div>

      {/* ── Industry ─────────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Industry
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* Industry category */}
          <div>
            <FieldLabel label="Category" optional htmlFor="industry_category" />
            <SelectWrapper>
              <select
                id="industry_category"
                value={values.industry_category}
                onChange={(e) => handleIndustryCategoryChange(e.target.value)}
                disabled={disabled}
                className={SELECT_H}
              >
                <option value="">Select category</option>
                {INDUSTRY_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </SelectWrapper>
          </div>

          {/* Industry */}
          <div>
            <FieldLabel label="Industry" optional htmlFor="industry" />
            <SelectWrapper>
              <select
                id="industry"
                value={values.industry}
                onChange={(e) => onChange("industry", e.target.value)}
                disabled={disabled || !values.industry_category}
                className={values.industry_category ? SELECT_H : SELECT_DISABLED}
              >
                <option value="">
                  {values.industry_category ? "Select industry" : "Select category first"}
                </option>
                {industries.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </SelectWrapper>
          </div>

        </div>
      </div>

      {/* ── Location ─────────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
          Location
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

          {/* State */}
          <div>
            <FieldLabel label="State" optional htmlFor="state" />
            <SelectWrapper>
              <select
                id="state"
                value={values.state}
                onChange={(e) => handleStateChange(e.target.value)}
                disabled={disabled}
                className={SELECT_H}
              >
                <option value="">Select state</option>
                {US_STATES.map((s) => (
                  <option key={s.abbr} value={s.abbr}>{s.name}</option>
                ))}
              </select>
            </SelectWrapper>
          </div>

          {/* County */}
          <div>
            <FieldLabel label="County" optional htmlFor="county" />
            <SelectWrapper>
              <select
                id="county"
                value={values.county}
                onChange={(e) => handleCountyChange(e.target.value)}
                disabled={disabled || !values.state}
                className={values.state ? SELECT_H : SELECT_DISABLED}
              >
                <option value="">
                  {values.state ? "Select county" : "Select state first"}
                </option>
                {counties.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </SelectWrapper>
          </div>

          {/* City */}
          <div>
            <FieldLabel label="City" optional htmlFor="city" />
            {cities.length > 0 ? (
              <SelectWrapper>
                <select
                  id="city"
                  value={values.city}
                  onChange={(e) => onChange("city", e.target.value)}
                  disabled={disabled || !values.county}
                  className={values.county ? SELECT_H : SELECT_DISABLED}
                >
                  <option value="">
                    {values.county ? "Select city" : "Select county first"}
                  </option>
                  {cities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </SelectWrapper>
            ) : (
              <input
                id="city"
                type="text"
                value={values.city}
                onChange={(e) => onChange("city", e.target.value)}
                disabled={disabled || !values.county}
                placeholder={values.county ? "Enter city" : "Select county first"}
                className={INPUT_H}
              />
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
