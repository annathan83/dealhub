/**
 * phoneUtils — phone number normalization and formatting helpers.
 *
 * The broker_contact fact stores free-form text like:
 *   "(305) 555-1234"
 *   "305.555.1234"
 *   "3055551234"
 *   "+1 305 555 1234"
 *   "john@broker.com"          ← email, not a phone
 *   "john@broker.com / (305) 555-1234"  ← mixed
 *
 * These helpers extract and normalize phone numbers from that text.
 */

// ─── Normalization ────────────────────────────────────────────────────────────

/**
 * Strip a raw string down to digits only.
 */
function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Return a `tel:`-safe dial string from a raw phone input.
 *
 * Rules:
 *  - 10 digits (US) → "3055551234"
 *  - 11 digits starting with 1 (US with country code) → "+13055551234"
 *  - Other lengths → return as-is after stripping non-dial chars
 *  - Returns null if the input looks like an email or has fewer than 7 digits
 */
export function normalizePhoneForDial(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;

  // Extract the first phone-like token from mixed text (e.g. "email / phone")
  const phoneToken = extractPhoneToken(raw);
  if (!phoneToken) return null;

  const digits = digitsOnly(phoneToken);

  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return `+1${digits.slice(1)}`;
  // International: keep the + prefix if present
  if (digits.length > 11) {
    const hasPlus = phoneToken.trimStart().startsWith("+");
    return hasPlus ? `+${digits}` : digits;
  }
  // 7-digit local numbers — return as-is
  if (digits.length >= 7) return digits;

  return null;
}

/**
 * Format a raw phone string for clean display.
 *
 * Examples:
 *   "3055551234"        → "(305) 555-1234"
 *   "+13055551234"      → "(305) 555-1234"
 *   "305.555.1234"      → "(305) 555-1234"
 *   "+44 20 7946 0958"  → "+44 20 7946 0958"  (international — kept as-is)
 *   null / ""           → null
 */
export function formatPhoneDisplay(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;

  const phoneToken = extractPhoneToken(raw);
  if (!phoneToken) return null;

  const digits = digitsOnly(phoneToken);

  // US 10-digit
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  // US 11-digit with leading 1
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  // International — return the original token cleaned up
  return phoneToken.trim();
}

/**
 * Return true if the string looks like it contains a phone number
 * (not just an email address).
 */
export function looksLikePhone(raw: string | null | undefined): boolean {
  if (!raw?.trim()) return false;
  return extractPhoneToken(raw) !== null;
}

/**
 * Extract the first phone-like token from a mixed string.
 * Skips tokens that look like email addresses.
 *
 * Handles separators like " / ", " | ", " · ", newlines, commas.
 */
function extractPhoneToken(raw: string): string | null {
  // Split on common separators
  const parts = raw.split(/[/|·,\n]+/).map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    // Skip email-looking tokens
    if (part.includes("@")) continue;
    // Must contain at least 7 digits
    const digits = digitsOnly(part);
    if (digits.length >= 7) return part;
  }

  // Fallback: try the whole string if it has enough digits and no @
  if (!raw.includes("@")) {
    const digits = digitsOnly(raw);
    if (digits.length >= 7) return raw.trim();
  }

  return null;
}

/**
 * Extract the first email-like token from a mixed string.
 */
export function extractEmail(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const parts = raw.split(/[/|·,\n]+/).map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (part.includes("@") && part.includes(".")) return part;
  }
  // Fallback: check whole string
  if (raw.includes("@") && raw.includes(".")) return raw.trim();
  return null;
}
