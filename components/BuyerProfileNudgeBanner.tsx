"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

const PROFILE_NUDGE_STORAGE_KEY = "dealhub_profile_nudge_dismissed";

type Props = {
  userDealCount: number;
  buyerProfileCompleted: boolean;
};

export default function BuyerProfileNudgeBanner({ userDealCount, buyerProfileCompleted }: Props) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(!!localStorage.getItem(PROFILE_NUDGE_STORAGE_KEY));
  }, []);

  const show = userDealCount === 1 && !buyerProfileCompleted && !dismissed;
  if (!show) return null;

  const dismiss = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(PROFILE_NUDGE_STORAGE_KEY, "true");
      setDismissed(true);
    }
  };

  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 mb-4">
      <p className="text-sm font-medium text-teal-900">
        🎯 Set up your Buyer Profile to unlock Fit scoring
      </p>
      <p className="text-sm text-teal-800 mt-1">
        Tell us your criteria once — we&apos;ll score every deal against your profile automatically.
      </p>
      <div className="flex flex-wrap items-center gap-3 mt-3">
        <Link
          href="/settings/buyer-profile"
          className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 transition-colors"
        >
          Set up profile →
        </Link>
        <button
          type="button"
          onClick={dismiss}
          className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  );
}
