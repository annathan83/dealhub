/**
 * DealHubLogo
 *
 * SVG-based logo components derived from the verified brand asset.
 * The icon is a rounded-corner D-shape with a green→blue gradient fill
 * and a white checkmark inside.
 *
 * Variants:
 *   <DealHubIcon />          — icon mark only (D + checkmark)
 *   <DealHubWordmark />      — icon + "DealHub" text
 *   <DealHubIconMono />      — single-color version (for dark backgrounds etc.)
 */

// ─── Icon mark ────────────────────────────────────────────────────────────────

export function DealHubIcon({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const id = `dh-grad-${size}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="DealHub"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3DBE8B" />
          <stop offset="100%" stopColor="#2A6FBF" />
        </linearGradient>
      </defs>
      {/* D-shape: rounded rectangle with right side curved */}
      <path
        d="M14 10 H52 C76 10 88 26 88 50 C88 74 76 90 52 90 H14 Z"
        fill={`url(#${id})`}
        rx="8"
      />
      {/* White checkmark */}
      <path
        d="M30 52 L43 65 L70 36"
        stroke="white"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// ─── Icon mark — dark mode (white/light version) ──────────────────────────────

export function DealHubIconDark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="DealHub"
    >
      {/* D-shape with semi-transparent white fill */}
      <path
        d="M14 10 H52 C76 10 88 26 88 50 C88 74 76 90 52 90 H14 Z"
        fill="rgba(255,255,255,0.15)"
      />
      {/* White checkmark */}
      <path
        d="M30 52 L43 65 L70 36"
        stroke="white"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// ─── Icon mark — monochrome ───────────────────────────────────────────────────

export function DealHubIconMono({
  size = 32,
  color = "#1F7A63",
  className = "",
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="DealHub"
    >
      <path
        d="M14 10 H52 C76 10 88 26 88 50 C88 74 76 90 52 90 H14 Z"
        fill={color}
      />
      <path
        d="M30 52 L43 65 L70 36"
        stroke="white"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// ─── Full wordmark (icon + text) ──────────────────────────────────────────────

export function DealHubWordmark({
  iconSize = 28,
  className = "",
  textClassName = "",
}: {
  iconSize?: number;
  className?: string;
  textClassName?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <DealHubIcon size={iconSize} />
      <span className={`font-bold tracking-tight leading-none ${textClassName}`}>
        Deal<span className="text-[#1F7A63]">Hub</span>
      </span>
    </span>
  );
}

// ─── Full wordmark — dark background ─────────────────────────────────────────

export function DealHubWordmarkDark({
  iconSize = 28,
  className = "",
}: {
  iconSize?: number;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <DealHubIconDark size={iconSize} />
      <span className="font-bold tracking-tight leading-none text-white">
        Deal<span className="text-[#3DBE8B]">Hub</span>
      </span>
    </span>
  );
}
