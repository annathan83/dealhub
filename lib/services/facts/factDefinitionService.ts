/**
 * factDefinitionService
 *
 * Helpers for working with fact_definitions and entity_fact_values.
 * Provides fact coverage analysis and applicable-fact lookups.
 */

import { createClient } from "@/lib/supabase/server";
import {
  getFactDefinitionsForEntityType,
  getCurrentFactsForEntity,
} from "@/lib/db/entities";
import type { FactDefinition, EntityFactValue, FactValueStatus } from "@/types/entity";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FactCoverage = {
  total: number;
  confirmed: number;
  missing_critical: number;
  conflicting: number;
  coverage_pct: number;
  missing_critical_facts: FactDefinition[];
};

export type FactWithCurrentValue = FactDefinition & {
  current_value: EntityFactValue | null;
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Get all fact definitions applicable to the entity's type,
 * enriched with the current value for the entity (if any).
 */
export async function getApplicableFactsForEntityType(
  entityTypeId: string,
  entityId?: string
): Promise<FactWithCurrentValue[]> {
  const factDefs = await getFactDefinitionsForEntityType(entityTypeId);

  if (!entityId) {
    return factDefs.map((fd) => ({ ...fd, current_value: null }));
  }

  const currentValues = await getCurrentFactsForEntity(entityId);
  const valueByFactId = new Map<string, EntityFactValue>();
  for (const v of currentValues) {
    valueByFactId.set(v.fact_definition_id, v);
  }

  return factDefs.map((fd) => ({
    ...fd,
    current_value: valueByFactId.get(fd.id) ?? null,
  }));
}

/**
 * Compute fact coverage statistics for an entity.
 * Returns counts and the list of missing critical facts.
 */
export async function getFactCoverage(
  entityId: string,
  entityTypeId: string
): Promise<FactCoverage> {
  const factsWithValues = await getApplicableFactsForEntityType(entityTypeId, entityId);

  const total = factsWithValues.length;
  let confirmed = 0;
  let conflicting = 0;
  const missingCritical: FactDefinition[] = [];

  for (const f of factsWithValues) {
    const status: FactValueStatus = f.current_value?.status ?? "missing";
    if (status === "confirmed" || status === "estimated") confirmed++;
    if (status === "conflicting") conflicting++;
    if (f.is_critical && (status === "missing" || status === "unclear")) {
      missingCritical.push(f);
    }
  }

  const coverage_pct = total > 0 ? Math.round((confirmed / total) * 100) : 0;

  return {
    total,
    confirmed,
    missing_critical: missingCritical.length,
    conflicting,
    coverage_pct,
    missing_critical_facts: missingCritical,
  };
}

/**
 * Get only the critical fact definitions for an entity type.
 * Used for the first-pass extraction to keep token costs low.
 */
export async function getCriticalFactDefinitions(
  entityTypeId: string
): Promise<FactDefinition[]> {
  const all = await getFactDefinitionsForEntityType(entityTypeId);
  return all.filter((fd) => fd.is_critical);
}

/**
 * Look up a fact_definition by its key.
 */
export async function getFactDefinitionByKey(
  key: string
): Promise<FactDefinition | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fact_definitions")
    .select("*")
    .eq("key", key)
    .maybeSingle();

  if (!data) return null;

  return {
    id: data.id as string,
    key: data.key as string,
    label: data.label as string,
    description: (data.description as string | null) ?? null,
    category: (data.category as FactDefinition["category"]) ?? null,
    data_type: data.data_type as FactDefinition["data_type"],
    is_critical: (data.is_critical as boolean) ?? false,
    is_multi_value: (data.is_multi_value as boolean) ?? false,
    fact_scope: (data.fact_scope as FactDefinition["fact_scope"]) ?? "deep",
    display_order: (data.display_order as number | null) ?? null,
    is_user_visible_initially: (data.is_user_visible_initially as boolean) ?? false,
    is_required_for_kpi: (data.is_required_for_kpi as boolean) ?? false,
    industry_key: (data.industry_key as string | null) ?? null,
    is_derived: (data.is_derived as boolean) ?? false,
    fact_group: (data.fact_group as FactDefinition["fact_group"]) ?? null,
    metadata_json: (data.metadata_json as Record<string, unknown>) ?? {},
    created_at: data.created_at as string,
  };
}
