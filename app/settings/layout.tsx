/**
 * Settings layout — shared sub-nav for all settings pages.
 */

import Link from "next/link";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      {/* Settings sub-nav */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6">
          <nav className="flex gap-1 -mb-px">
            <SettingsNavLink href="/settings/integrations" label="Integrations" />
            <SettingsNavLink href="/settings/buyer-profile" label="Buyer Profile" />
            <SettingsNavLink href="/settings/scoring" label="Scoring" />
          </nav>
        </div>
      </div>

      {children}
    </div>
  );
}

function SettingsNavLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-900 border-b-2 border-transparent hover:border-slate-300 transition-colors"
    >
      {label}
    </Link>
  );
}
