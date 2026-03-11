/**
 * dealContactService
 *
 * Manages structured broker/seller contacts for deals.
 *
 * Architecture:
 *   - deal_contacts is the authoritative store for contact info.
 *   - AI extraction populates it via syncContactsFromFacts().
 *   - User edits set source_type = 'user_entered' and are never overwritten
 *     by AI extraction (manual override protection).
 *   - The primary contact (is_primary = true) is shown in the deal list and
 *     deal header. At most one primary contact per deal.
 */

import { createClient } from "@/lib/supabase/server";
import { normalizePhoneForDial } from "@/lib/phoneUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ContactRole = "broker" | "assistant" | "seller" | "other";
export type ContactSourceType = "ai_extracted" | "user_entered" | "imported";

export type DealContact = {
  id: string;
  deal_id: string;
  user_id: string;
  name: string | null;
  role: ContactRole;
  phone: string | null;
  email: string | null;
  brokerage: string | null;
  source_type: ContactSourceType;
  source_label: string | null;
  source_file_id: string | null;
  confidence: number | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
};

export type ContactInput = {
  name?: string | null;
  role?: ContactRole;
  phone?: string | null;
  email?: string | null;
  brokerage?: string | null;
  source_type?: ContactSourceType;
  source_label?: string | null;
  source_file_id?: string | null;
  confidence?: number | null;
  is_primary?: boolean;
};

/** Extracted contact candidate from AI fact values */
export type ExtractedContactCandidate = {
  name: string | null;
  phone: string | null;
  email: string | null;
  brokerage: string | null;
  confidence: number;
  source_label: string;
  source_file_id: string | null;
};

// ─── Phone normalization ──────────────────────────────────────────────────────

/**
 * Normalize a phone number to digits only for deduplication comparison.
 * Returns null if the input doesn't look like a phone number.
 */
export function normalizePhoneDigits(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, "");
  // US: strip leading 1 from 11-digit numbers for comparison
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length >= 7) return digits;
  return null;
}

/**
 * Normalize an email for deduplication comparison (lowercase, trimmed).
 */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const e = raw.trim().toLowerCase();
  return e.includes("@") ? e : null;
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Determine if two contacts are likely the same person.
 * Matches on: same phone digits, same email, or same name (case-insensitive).
 */
export function contactsAreDuplicates(
  a: Partial<DealContact>,
  b: Partial<DealContact>
): boolean {
  // Phone match
  const phoneA = normalizePhoneDigits(a.phone);
  const phoneB = normalizePhoneDigits(b.phone);
  if (phoneA && phoneB && phoneA === phoneB) return true;

  // Email match
  const emailA = normalizeEmail(a.email);
  const emailB = normalizeEmail(b.email);
  if (emailA && emailB && emailA === emailB) return true;

  // Name match (only if both have names and no phone/email to compare)
  if (!phoneA && !phoneB && !emailA && !emailB) {
    const nameA = a.name?.trim().toLowerCase();
    const nameB = b.name?.trim().toLowerCase();
    if (nameA && nameB && nameA === nameB) return true;
  }

  return false;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Get all contacts for a deal, ordered by is_primary desc, created_at asc.
 */
export async function getDealContacts(
  dealId: string,
  userId: string
): Promise<DealContact[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_contacts")
    .select("*")
    .eq("deal_id", dealId)
    .eq("user_id", userId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[dealContactService] getDealContacts:", error.message);
    return [];
  }
  return (data ?? []) as DealContact[];
}

/**
 * Get the primary contact for a deal (or null if none).
 */
export async function getPrimaryContact(
  dealId: string,
  userId: string
): Promise<DealContact | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("deal_contacts")
    .select("*")
    .eq("deal_id", dealId)
    .eq("user_id", userId)
    .eq("is_primary", true)
    .maybeSingle();
  return (data as DealContact | null) ?? null;
}

/**
 * Sync the primary contact's name, email, phone to the deal row (denormalized).
 * Keeps deals.broker_* in sync for list display and search when no brokerMap is used.
 */
export async function syncPrimaryContactToDeal(
  dealId: string,
  userId: string
): Promise<void> {
  const primary = await getPrimaryContact(dealId, userId);
  const supabase = await createClient();
  await supabase
    .from("deals")
    .update({
      broker_name: primary?.name ?? null,
      broker_email: primary?.email ?? null,
      broker_phone: primary?.phone ?? null,
    })
    .eq("id", dealId)
    .eq("user_id", userId);
}

// ─── Write ────────────────────────────────────────────────────────────────────

/**
 * Ensure at most one primary contact per deal.
 * If is_primary = true on the new/updated contact, demote all others.
 */
async function ensureSinglePrimary(
  dealId: string,
  userId: string,
  exceptId: string | null
): Promise<void> {
  const supabase = await createClient();
  let query = supabase
    .from("deal_contacts")
    .update({ is_primary: false })
    .eq("deal_id", dealId)
    .eq("user_id", userId)
    .eq("is_primary", true);

  if (exceptId) {
    query = query.neq("id", exceptId);
  }
  await query;
}

/**
 * Create a new contact for a deal.
 * If is_primary is true, demotes all other contacts first.
 */
export async function createDealContact(
  dealId: string,
  userId: string,
  input: ContactInput
): Promise<DealContact | null> {
  const supabase = await createClient();

  if (input.is_primary) {
    await ensureSinglePrimary(dealId, userId, null);
  }

  const { data, error } = await supabase
    .from("deal_contacts")
    .insert({
      deal_id: dealId,
      user_id: userId,
      name: input.name ?? null,
      role: input.role ?? "broker",
      phone: input.phone ?? null,
      email: input.email ?? null,
      brokerage: input.brokerage ?? null,
      source_type: input.source_type ?? "ai_extracted",
      source_label: input.source_label ?? null,
      source_file_id: input.source_file_id ?? null,
      confidence: input.confidence ?? null,
      is_primary: input.is_primary ?? false,
    })
    .select()
    .single();

  if (error) {
    console.error("[dealContactService] createDealContact:", error.message);
    return null;
  }
  return data as DealContact;
}

/**
 * Update an existing contact.
 * If source_type = 'user_entered', marks the contact as manually edited.
 * If is_primary is being set to true, demotes all other contacts.
 */
export async function updateDealContact(
  contactId: string,
  userId: string,
  input: Partial<ContactInput>
): Promise<DealContact | null> {
  const supabase = await createClient();

  // Fetch current to get deal_id for primary demotion
  const { data: current } = await supabase
    .from("deal_contacts")
    .select("deal_id, is_primary")
    .eq("id", contactId)
    .eq("user_id", userId)
    .single();

  if (!current) return null;

  if (input.is_primary === true && !current.is_primary) {
    await ensureSinglePrimary(current.deal_id as string, userId, contactId);
  }

  const { data, error } = await supabase
    .from("deal_contacts")
    .update({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.role !== undefined && { role: input.role }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.brokerage !== undefined && { brokerage: input.brokerage }),
      ...(input.source_type !== undefined && { source_type: input.source_type }),
      ...(input.source_label !== undefined && { source_label: input.source_label }),
      ...(input.confidence !== undefined && { confidence: input.confidence }),
      ...(input.is_primary !== undefined && { is_primary: input.is_primary }),
    })
    .eq("id", contactId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) {
    console.error("[dealContactService] updateDealContact:", error.message);
    return null;
  }
  return data as DealContact;
}

/**
 * Delete a contact.
 * If the deleted contact was primary, promotes the next contact (by created_at).
 */
export async function deleteDealContact(
  contactId: string,
  userId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("deal_contacts")
    .select("deal_id, is_primary")
    .eq("id", contactId)
    .eq("user_id", userId)
    .single();

  const { error } = await supabase
    .from("deal_contacts")
    .delete()
    .eq("id", contactId)
    .eq("user_id", userId);

  if (error) {
    console.error("[dealContactService] deleteDealContact:", error.message);
    return false;
  }

  // If deleted contact was primary, promote the next one
  if (current?.is_primary) {
    const { data: next } = await supabase
      .from("deal_contacts")
      .select("id")
      .eq("deal_id", current.deal_id as string)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (next?.id) {
      await supabase
        .from("deal_contacts")
        .update({ is_primary: true })
        .eq("id", next.id)
        .eq("user_id", userId);
    }
  }

  return true;
}

// ─── Sync from AI extraction ──────────────────────────────────────────────────

/**
 * Sync extracted contact candidates into deal_contacts.
 *
 * Rules:
 *   1. Never overwrite a user_entered contact's fields.
 *   2. Deduplicate by phone digits, email, or name.
 *   3. If a matching AI contact already exists, update it only if the new
 *      confidence is higher.
 *   4. If no contacts exist yet, mark the first one as primary.
 *   5. If the primary contact is user_entered, leave is_primary alone.
 */
export async function syncContactsFromExtraction(
  dealId: string,
  userId: string,
  candidates: ExtractedContactCandidate[]
): Promise<void> {
  if (candidates.length === 0) return;

  const supabase = await createClient();
  const existing = await getDealContacts(dealId, userId);
  const hasPrimary = existing.some((c) => c.is_primary);

  for (const candidate of candidates) {
    // Skip candidates with no useful data
    if (!candidate.name && !candidate.phone && !candidate.email) continue;

    // Find a matching existing contact
    const match = existing.find((e) =>
      contactsAreDuplicates(e, {
        name: candidate.name,
        phone: candidate.phone,
        email: candidate.email,
      })
    );

    if (match) {
      // Never overwrite user_entered contacts
      if (match.source_type === "user_entered") continue;

      // Only update if new confidence is higher or fields are being filled in
      const newConf = candidate.confidence ?? 0;
      const existConf = match.confidence ?? 0;
      const hasNewFields =
        (candidate.phone && !match.phone) ||
        (candidate.email && !match.email) ||
        (candidate.brokerage && !match.brokerage) ||
        (candidate.name && !match.name);

      if (newConf > existConf || hasNewFields) {
        await supabase
          .from("deal_contacts")
          .update({
            name: candidate.name ?? match.name,
            phone: candidate.phone ?? match.phone,
            email: candidate.email ?? match.email,
            brokerage: candidate.brokerage ?? match.brokerage,
            confidence: Math.max(newConf, existConf),
            source_label: candidate.source_label,
            source_file_id: candidate.source_file_id ?? match.source_file_id,
          })
          .eq("id", match.id)
          .eq("user_id", userId);
      }
    } else {
      // Insert new contact
      const isPrimary = !hasPrimary && existing.length === 0;
      await supabase.from("deal_contacts").insert({
        deal_id: dealId,
        user_id: userId,
        name: candidate.name,
        role: "broker",
        phone: candidate.phone,
        email: candidate.email,
        brokerage: candidate.brokerage,
        source_type: "ai_extracted",
        source_label: candidate.source_label,
        source_file_id: candidate.source_file_id,
        confidence: candidate.confidence,
        is_primary: isPrimary,
      });

      // Mark that we now have a primary
      if (isPrimary) {
        existing.push({ is_primary: true } as DealContact);
      }
    }
  }

  // If still no primary after sync, promote the highest-confidence AI contact
  const afterSync = await getDealContacts(dealId, userId);
  if (!afterSync.some((c) => c.is_primary) && afterSync.length > 0) {
    const best = afterSync
      .filter((c) => c.source_type !== "user_entered")
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0];
    if (best) {
      await supabase
        .from("deal_contacts")
        .update({ is_primary: true })
        .eq("id", best.id)
        .eq("user_id", userId);
    }
  }
}

/**
 * Extract contact candidates from AI fact values.
 *
 * Called after fact reconciliation — reads the current entity_fact_values
 * for broker_name, broker_phone, broker_email, broker_contact, broker_brokerage
 * and converts them into ExtractedContactCandidate objects.
 */
export async function extractContactsFromFactValues(
  entityId: string,
  sourceFileId: string | null,
  sourceLabel: string
): Promise<ExtractedContactCandidate[]> {
  const supabase = await createClient();

  // Fetch broker-related fact definitions
  const { data: factDefs } = await supabase
    .from("fact_definitions")
    .select("id, key")
    .in("key", ["broker_name", "broker_phone", "broker_email", "broker_contact", "broker_brokerage"]);

  if (!factDefs || factDefs.length === 0) return [];

  const defMap = new Map(factDefs.map((fd: { id: string; key: string }) => [fd.key, fd.id]));

  // Fetch current fact values for this entity
  const defIds = factDefs.map((fd: { id: string }) => fd.id);
  const { data: factValues } = await supabase
    .from("entity_fact_values")
    .select("fact_definition_id, value_raw, confidence")
    .eq("entity_id", entityId)
    .in("fact_definition_id", defIds);

  if (!factValues || factValues.length === 0) return [];

  const valMap = new Map(
    factValues.map((fv: { fact_definition_id: string; value_raw: string | null; confidence: number | null }) => [
      fv.fact_definition_id,
      { value: fv.value_raw, confidence: fv.confidence },
    ])
  );

  const get = (key: string) => {
    const id = defMap.get(key);
    if (!id) return null;
    return valMap.get(id) ?? null;
  };

  const nameEntry    = get("broker_name");
  const phoneEntry   = get("broker_phone");
  const emailEntry   = get("broker_email");
  const contactEntry = get("broker_contact");
  const brokerageEntry = get("broker_brokerage");

  // Parse broker_contact (legacy combined field) for phone/email if separate fields are empty
  let parsedPhone: string | null = null;
  let parsedEmail: string | null = null;
  if (contactEntry?.value) {
    const { looksLikePhone, extractEmail } = await import("@/lib/phoneUtils");
    if (looksLikePhone(contactEntry.value)) parsedPhone = contactEntry.value;
    parsedEmail = extractEmail(contactEntry.value);
  }

  const phone    = phoneEntry?.value ?? parsedPhone;
  const email    = emailEntry?.value ?? parsedEmail;
  const name     = nameEntry?.value ?? null;
  const brokerage = brokerageEntry?.value ?? null;

  if (!name && !phone && !email) return [];

  const confidence = Math.max(
    nameEntry?.confidence ?? 0,
    phoneEntry?.confidence ?? contactEntry?.confidence ?? 0,
    emailEntry?.confidence ?? contactEntry?.confidence ?? 0
  );

  return [
    {
      name,
      phone,
      email,
      brokerage,
      confidence: confidence > 0 ? confidence : 0.7,
      source_label: sourceLabel,
      source_file_id: sourceFileId,
    },
  ];
}

// ─── Dashboard bulk fetch ─────────────────────────────────────────────────────

/**
 * Fetch primary contacts for a list of deals in a single query.
 * Returns a map of dealId → DealContact.
 * Used by the dashboard page to build the brokerMap efficiently.
 */
export async function getPrimaryContactsForDeals(
  dealIds: string[],
  userId: string
): Promise<Record<string, DealContact>> {
  if (dealIds.length === 0) return {};

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deal_contacts")
    .select("*")
    .in("deal_id", dealIds)
    .eq("user_id", userId)
    .eq("is_primary", true);

  if (error) {
    console.error("[dealContactService] getPrimaryContactsForDeals:", error.message);
    return {};
  }

  const result: Record<string, DealContact> = {};
  for (const row of data ?? []) {
    const contact = row as DealContact;
    result[contact.deal_id] = contact;
  }
  return result;
}
