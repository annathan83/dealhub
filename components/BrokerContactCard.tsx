"use client";

/**
 * BrokerContactCard
 *
 * Shown at the top of the deal detail page (inside DealHeader).
 * Displays the primary contact with Name, Email, Phone and actions:
 * Call, Email, Copy Phone.
 * Allows editing all contacts and adding new ones.
 *
 * Deal list: does NOT use this component — it uses BrokerInfo + BrokerPhoneButton.
 */

import { useState, useTransition, useCallback } from "react";
import PhoneLink from "@/components/PhoneLink";
import { formatPhoneDisplay, normalizePhoneForDial } from "@/lib/phoneUtils";
import type { DealContact, ContactRole } from "@/lib/services/contacts/dealContactService";

// ─── Role labels ──────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<ContactRole, string> = {
  broker:    "Broker",
  assistant: "Assistant",
  seller:    "Seller",
  other:     "Contact",
};

const ROLE_OPTIONS: { value: ContactRole; label: string }[] = [
  { value: "broker",    label: "Broker" },
  { value: "assistant", label: "Assistant" },
  { value: "seller",    label: "Seller" },
  { value: "other",     label: "Other" },
];

// ─── Source badge ─────────────────────────────────────────────────────────────

function SourceBadge({ contact }: { contact: DealContact }) {
  if (contact.source_type === "user_entered") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-full">
        <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
        </svg>
        Edited
      </span>
    );
  }
  const conf = contact.confidence ?? 0;
  if (conf >= 0.7) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full">
        <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        AI Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-yellow-700 bg-yellow-50 border border-yellow-200 px-1.5 py-0.5 rounded-full">
      <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <path strokeLinecap="round" d="M12 6v6l4 2" />
      </svg>
      Needs Review
    </span>
  );
}

// ─── Edit contact modal ───────────────────────────────────────────────────────

type EditContactModalProps = {
  dealId: string;
  contact: DealContact | null;  // null = new contact
  onClose: () => void;
  onSaved: (contact: DealContact) => void;
  onDeleted?: (contactId: string) => void;
};

function EditContactModal({ dealId, contact, onClose, onSaved, onDeleted }: EditContactModalProps) {
  const isNew = contact === null;
  const [name,      setName]      = useState(contact?.name      ?? "");
  const [role,      setRole]      = useState<ContactRole>(contact?.role ?? "broker");
  const [phone,     setPhone]     = useState(contact?.phone     ?? "");
  const [email,     setEmail]     = useState(contact?.email     ?? "");
  const [brokerage, setBrokerage] = useState(contact?.brokerage ?? "");
  const [isPrimary, setIsPrimary] = useState(contact?.is_primary ?? false);
  const [saving,    startSave]    = useTransition();
  const [deleting,  startDelete]  = useTransition();
  const [error,     setError]     = useState<string | null>(null);

  function handleSave() {
    startSave(async () => {
      setError(null);
      const body = {
        name:       name.trim()      || null,
        role,
        phone:      phone.trim()     || null,
        email:      email.trim()     || null,
        brokerage:  brokerage.trim() || null,
        is_primary: isPrimary,
      };

      const url = isNew
        ? `/api/deals/${dealId}/contacts`
        : `/api/deals/${dealId}/contacts/${contact!.id}`;
      const method = isNew ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error ?? "Failed to save contact");
        return;
      }

      const data = await res.json();
      onSaved((data as { contact: DealContact }).contact);
      onClose();
    });
  }

  function handleDelete() {
    if (!contact) return;
    startDelete(async () => {
      setError(null);
      const res = await fetch(`/api/deals/${dealId}/contacts/${contact.id}`, { method: "DELETE" });
      if (!res.ok) {
        setError("Failed to delete contact");
        return;
      }
      onDeleted?.(contact.id);
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800">
            {isNew ? "Add Contact" : "Edit Contact"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 flex flex-col gap-3">
          {/* Role */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Role
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRole(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    role === opt.value
                      ? "bg-[#1F7A63] text-white border-[#1F7A63]"
                      : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Jane Smith"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F7A63] focus:border-transparent"
            />
          </div>

          {/* Phone */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Phone
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. (305) 555-1234"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F7A63] focus:border-transparent"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. jane@broker.com"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F7A63] focus:border-transparent"
            />
          </div>

          {/* Brokerage */}
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5">
              Brokerage
            </label>
            <input
              type="text"
              value={brokerage}
              onChange={(e) => setBrokerage(e.target.value)}
              placeholder="e.g. Sunbelt Business Advisors"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1F7A63] focus:border-transparent"
            />
          </div>

          {/* Primary toggle */}
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div
              onClick={() => setIsPrimary((p) => !p)}
              className={`relative w-9 h-5 rounded-full transition-colors ${isPrimary ? "bg-[#1F7A63]" : "bg-slate-200"}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isPrimary ? "translate-x-4" : "translate-x-0"}`} />
            </div>
            <span className="text-xs font-semibold text-slate-600">Primary contact</span>
          </label>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || deleting}
            className="flex-1 rounded-xl bg-[#1F7A63] text-white text-sm font-semibold py-2.5 hover:bg-[#1a6654] disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {!isNew && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={saving || deleting}
              className="px-4 py-2.5 rounded-xl border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {deleting ? "…" : "Delete"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={saving || deleting}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-500 text-sm font-medium hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Single contact row (for the "other contacts" list) ───────────────────────

function ContactRow({
  contact,
  onEdit,
}: {
  contact: DealContact;
  onEdit: () => void;
}) {
  const phone = contact.phone;
  const email = contact.email;

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {contact.name && (
            <span className="text-xs font-semibold text-slate-700">{contact.name}</span>
          )}
          <span className="text-[10px] text-slate-400 font-medium">
            {ROLE_LABELS[contact.role]}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {phone && (
            <PhoneLink
              raw={phone}
              displayOverride={formatPhoneDisplay(phone)}
              stopPropagation={false}
              className="text-xs"
            />
          )}
          {email && (
            <a
              href={`mailto:${email}`}
              className="text-xs text-slate-500 hover:text-[#1F7A63] transition-colors truncate max-w-[180px]"
            >
              {email}
            </a>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        aria-label="Edit contact"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BrokerContactCard({
  dealId,
  initialContacts,
}: {
  dealId: string;
  initialContacts: DealContact[];
}) {
  const [contacts,    setContacts]    = useState<DealContact[]>(initialContacts);
  const [editTarget,  setEditTarget]  = useState<DealContact | null | undefined>(undefined);
  // undefined = modal closed, null = new contact, DealContact = edit existing
  const [showOthers,  setShowOthers]  = useState(false);

  const primary = contacts.find((c) => c.is_primary) ?? contacts[0] ?? null;
  const others  = contacts.filter((c) => c.id !== primary?.id);

  const handleSaved = useCallback((saved: DealContact) => {
    setContacts((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        // If saved is now primary, demote others
        if (saved.is_primary) {
          return next.map((c) => c.id === saved.id ? c : { ...c, is_primary: false });
        }
        return next;
      }
      // New contact
      if (saved.is_primary) {
        return [saved, ...prev.map((c) => ({ ...c, is_primary: false }))];
      }
      return [...prev, saved];
    });
  }, []);

  const handleDeleted = useCallback((contactId: string) => {
    setContacts((prev) => {
      const remaining = prev.filter((c) => c.id !== contactId);
      // If deleted was primary, promote first remaining
      const hadPrimary = prev.find((c) => c.id === contactId)?.is_primary;
      if (hadPrimary && remaining.length > 0) {
        return remaining.map((c, i) => i === 0 ? { ...c, is_primary: true } : c);
      }
      return remaining;
    });
  }, []);

  if (contacts.length === 0) {
    return (
      <div className="border-t border-[#E5E7EB] px-4 py-3">
        <button
          type="button"
          onClick={() => setEditTarget(null)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-[#E5E7EB] text-xs text-[#6B7280] hover:border-[#1F7A63] hover:text-[#1F7A63] transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add broker contact
        </button>
        {editTarget === null && (
          <EditContactModal
            dealId={dealId}
            contact={null}
            onClose={() => setEditTarget(undefined)}
            onSaved={handleSaved}
          />
        )}
      </div>
    );
  }

  const phone = primary?.phone ?? null;
  const email = primary?.email ?? null;
  const hasContact = phone || email;
  const [copyPhoneFeedback, setCopyPhoneFeedback] = useState(false);
  const displayPhone = phone ? formatPhoneDisplay(phone) : null;

  function handleCopyPhone() {
    if (!displayPhone) return;
    navigator.clipboard.writeText(displayPhone).then(() => {
      setCopyPhoneFeedback(true);
      setTimeout(() => setCopyPhoneFeedback(false), 1500);
    });
  }

  return (
    <div className="border-t border-[#E5E7EB]">
      {/* Broker Contact block — Name, Email, Phone + Call / Email / Copy */}
      <div className="px-4 py-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
          Broker Contact
        </p>
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center mt-0.5">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            {/* Name */}
            {primary?.name && (
              <p className="text-sm font-semibold text-slate-800">
                Name: {primary.name}
              </p>
            )}
            {/* Email */}
            {email && (
              <p className="text-sm text-slate-600 mt-0.5">
                Email:{" "}
                <a
                  href={`mailto:${email}`}
                  className="text-[#1F7A63] hover:underline truncate max-w-[240px] inline-block align-bottom"
                >
                  {email}
                </a>
              </p>
            )}
            {/* Phone */}
            {phone && (
              <p className="text-sm text-slate-600 mt-0.5">
                Phone: {displayPhone}
              </p>
            )}

            {/* Role + source badge */}
            <div className="flex items-center gap-2 flex-wrap mt-1.5">
              {primary && (
                <span className="text-[10px] text-slate-400 font-medium">
                  {ROLE_LABELS[primary.role]}
                </span>
              )}
              {primary && <SourceBadge contact={primary} />}
              {primary?.brokerage && (
                <span className="text-[10px] text-slate-400">· {primary.brokerage}</span>
              )}
            </div>

            {/* Action buttons: Call, Email, Copy Phone */}
            {hasContact && (
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {phone && (
                  <>
                    <a
                      href={`tel:${normalizePhoneForDial(phone) ?? ""}`}
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl border border-[#E5E7EB] bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-[#1F7A63] hover:text-[#1F7A63] transition-colors touch-manipulation"
                      aria-label={`Call ${primary?.name ?? "broker"} at ${displayPhone}`}
                    >
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Call
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyPhone}
                      aria-label="Copy phone number"
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl border border-[#E5E7EB] bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-[#1F7A63] hover:text-[#1F7A63] transition-colors touch-manipulation"
                    >
                      {copyPhoneFeedback ? (
                        <>
                          <svg className="w-4 h-4 shrink-0 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Copied
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Phone
                        </>
                      )}
                    </button>
                  </>
                )}
                {email && (
                  <a
                    href={`mailto:${email}`}
                    className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 rounded-xl border border-[#E5E7EB] bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-[#1F7A63] hover:text-[#1F7A63] transition-colors touch-manipulation"
                    aria-label={`Email ${primary?.name ?? "broker"} at ${email}`}
                  >
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Edit button */}
          <button
            type="button"
            onClick={() => setEditTarget(primary ?? null)}
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Edit primary contact"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>

        {/* Other contacts toggle + add */}
        <div className="flex items-center gap-2 mt-2.5">
          {others.length > 0 && (
            <button
              type="button"
              onClick={() => setShowOthers((s) => !s)}
              className="text-[11px] text-slate-400 hover:text-[#1F7A63] transition-colors font-medium"
            >
              {showOthers ? "Hide" : `+${others.length} more contact${others.length !== 1 ? "s" : ""}`}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditTarget(null)}
            className="text-[11px] text-slate-400 hover:text-[#1F7A63] transition-colors font-medium"
          >
            + Add contact
          </button>
        </div>

        {/* Other contacts list */}
        {showOthers && others.length > 0 && (
          <div className="mt-2 divide-y divide-slate-100 border-t border-slate-100">
            {others.map((c) => (
              <ContactRow
                key={c.id}
                contact={c}
                onEdit={() => setEditTarget(c)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit / new contact modal */}
      {editTarget !== undefined && (
        <EditContactModal
          dealId={dealId}
          contact={editTarget}
          onClose={() => setEditTarget(undefined)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
