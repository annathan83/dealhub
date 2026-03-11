"use client";

import { normalizePhoneForDial, formatPhoneDisplay } from "@/lib/phoneUtils";

/**
 * PhoneLink — renders a tappable `tel:` anchor for a broker phone number.
 *
 * - Renders nothing if the raw value is not a valid phone number.
 * - Stops click propagation so it doesn't trigger parent row navigation.
 * - Mobile-friendly tap target (min 44px height via padding).
 * - Accessible: aria-label describes the action.
 */
export default function PhoneLink({
  raw,
  displayOverride,
  className,
  stopPropagation = true,
  showIcon = true,
  iconClassName,
}: {
  /** Raw phone string (may be mixed with email, e.g. from broker_contact fact) */
  raw: string | null | undefined;
  /** Optional pre-formatted display string. Falls back to formatPhoneDisplay(raw). */
  displayOverride?: string | null;
  /** Extra Tailwind classes for the anchor element. */
  className?: string;
  /** Whether to stop click propagation (default: true). Set false when not inside a clickable parent. */
  stopPropagation?: boolean;
  /** Show the phone handset icon (default: true). */
  showIcon?: boolean;
  /** Extra classes for the icon SVG. */
  iconClassName?: string;
}) {
  const dialString = normalizePhoneForDial(raw);
  if (!dialString) return null;

  const display = displayOverride ?? formatPhoneDisplay(raw) ?? dialString;

  function handleClick(e: React.MouseEvent) {
    if (stopPropagation) e.stopPropagation();
  }

  return (
    <a
      href={`tel:${dialString}`}
      onClick={handleClick}
      aria-label={`Call broker at ${display}`}
      className={[
        // Base: inline-flex, vertically centered, generous tap target
        "inline-flex items-center gap-1.5",
        "min-h-[36px] px-0 py-1",
        // Color: brand green, slightly muted — clearly actionable but not a blue browser link
        "text-[#1F7A63] hover:text-[#176B55]",
        "font-medium text-sm",
        "transition-colors duration-100",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F7A63] focus-visible:ring-offset-1 rounded",
        className ?? "",
      ].join(" ")}
    >
      {showIcon && (
        <svg
          className={`w-3.5 h-3.5 shrink-0 ${iconClassName ?? ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
          />
        </svg>
      )}
      <span>{display}</span>
    </a>
  );
}
