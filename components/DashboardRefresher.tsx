"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Refreshes the dashboard RSC payload on mount so the deal list is always fresh
 * (e.g. after creating a new deal and navigating back via "Deal Flow").
 * Next.js client-side router can serve a cached dashboard; refresh() forces a new fetch.
 */
export default function DashboardRefresher() {
  const router = useRouter();
  useEffect(() => {
    router.refresh();
  }, [router]);
  return null;
}
