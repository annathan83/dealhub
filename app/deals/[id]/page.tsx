import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import DealHeader from "@/components/DealHeader";
import DealPageTabs from "@/components/DealPageTabs";
import { syncAndListDealDriveFiles } from "@/lib/google/drive";
import { buildDealPageViewModel } from "@/lib/db/dealViewModel";
import { assembleTimeline } from "@/lib/services/entity/entityTimelineService";

export default async function DealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const vm = await buildDealPageViewModel(id, user.id).catch(() => null);
  if (!vm) notFound();

  const {
    deal,
    entityData,
    kpiScorecard,
    scoreHistory,
    triageSummary,
    triageSnapshot,
    deepAnalysis,
    deepAnalysisStale,
    deepAnalysisRunAt,
    latestSourceAt,
    entityEvents,
    entityFiles,
    swotAnalysis,
    missingInfo,
    buyerProfile,
  } = vm;

  const { data: tokenRow } = await supabase
    .from("google_oauth_tokens")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const isDriveConnected = !!tokenRow;

  const syncedFiles = isDriveConnected
    ? await syncAndListDealDriveFiles(user.id, id).catch(() => entityFiles)
    : entityFiles;

  // Detect if new files were added after the last triage summary
  const triageSummaryExists = !!triageSummary;
  const triageRunAt = triageSnapshot?.created_at ?? null;
  const newFilesAfterTriage = triageSummaryExists && triageRunAt
    ? syncedFiles.some((f) => new Date(f.uploaded_at) > new Date(triageRunAt))
    : false;

  // Assemble timeline items from raw events
  const timelineItems = assembleTimeline(
    entityEvents,
    syncedFiles,
    entityData?.analysis_snapshots ?? []
  );

  return (
    <div className="min-h-screen bg-[#F8FAF9]">
      <AppHeader />

      <main className="max-w-2xl mx-auto px-4 sm:px-5 pt-4 pb-24">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 hover:text-[#1F7A63] transition-colors font-medium"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Deal Flow
          </Link>
          <svg className="w-3 h-3 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-600 font-medium truncate">{deal.name}</span>
        </div>

        {/* ── Deal header (always visible) ─────────────────────────────── */}
        <DealHeader deal={deal} kpiScorecard={kpiScorecard} />

        {/* ── 3-tab workspace ──────────────────────────────────────────── */}
        <div className="mt-4">
          <DealPageTabs
            deal={deal}
            entityData={entityData}
            syncedFiles={syncedFiles}
            isDriveConnected={isDriveConnected}
            triageSummaryExists={triageSummaryExists}
            newFilesAfterTriage={newFilesAfterTriage}
            timelineItems={timelineItems}
            entityEvents={entityEvents}
            analysisSnapshots={entityData?.analysis_snapshots ?? []}
            kpiScorecard={kpiScorecard}
            scoreHistory={scoreHistory}
            deepAnalysis={deepAnalysis}
            deepAnalysisStale={deepAnalysisStale}
            deepAnalysisRunAt={deepAnalysisRunAt}
            latestSourceAt={latestSourceAt}
            swotAnalysis={swotAnalysis}
            missingInfo={missingInfo}
            buyerProfile={buyerProfile}
          />
        </div>

      </main>
    </div>
  );
}
