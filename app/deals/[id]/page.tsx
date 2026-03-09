import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import AddDealEntryForm from "@/components/AddDealEntryForm";
import DealEntriesList from "@/components/DealEntriesList";
import DealFilesPanel from "@/components/DealFilesPanel";
import DealHeader from "@/components/DealHeader";
import DealIntakeActions from "@/components/DealIntakeActions";
import DealIntelligencePanel from "@/components/DealIntelligencePanel";
import DealScorePanel from "@/components/DealScorePanel";
import DownloadEntriesButton from "@/components/DownloadEntriesButton";
import WorkspacePanel from "@/components/WorkspacePanel";
import { syncAndListDealDriveFiles } from "@/lib/google/drive";
import { buildDealPageViewModel } from "@/lib/db/dealViewModel";

export default async function DealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/signin");

  // ── Build view model (single call assembles all data) ─────────────────────
  const vm = await buildDealPageViewModel(id, user.id).catch(() => null);
  if (!vm) notFound();

  const { deal, sources, analyses, changeLog, driveFiles, latestInsight, latestOpinion, latestDelta } = vm;

  const analysisMap = new Map(analyses.map((a) => [a.deal_source_id, a]));
  const sourcesWithAnalysis = sources.map((s) => ({
    ...s,
    analysis: analysisMap.get(s.id) ?? null,
  }));

  // ── Google Drive connection check ─────────────────────────────────────────
  const { data: tokenRow } = await supabase
    .from("google_oauth_tokens")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const isDriveConnected = !!tokenRow;

  // Sync Drive files (may differ from cached driveFiles in vm if new uploads)
  const syncedDriveFiles = isDriveConnected
    ? await syncAndListDealDriveFiles(user.id, id).catch(() => driveFiles)
    : driveFiles;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-5">
          <Link href="/dashboard" className="hover:text-indigo-600 transition-colors font-medium">
            Dashboard
          </Link>
          <svg className="w-3 h-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-600 font-medium truncate max-w-[240px]">{deal.name}</span>
        </div>

        <DealHeader deal={deal} />

        <DealIntakeActions dealId={deal.id} isDriveConnected={isDriveConnected} />

        {/* 2-column workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
          {/* Left column */}
          <div className="flex flex-col gap-5 min-w-0 order-2 lg:order-1">
            {/* Add Entry */}
            <WorkspacePanel id="add-entry" title="Add Entry">
              <AddDealEntryForm dealId={deal.id} />
            </WorkspacePanel>

            {/* Deal Timeline */}
            <WorkspacePanel
              title="Deal Timeline"
              subtitle={sources.length > 0 ? `${sources.length} entr${sources.length === 1 ? "y" : "ies"}` : undefined}
              action={sources.length > 0 ? <DownloadEntriesButton dealName={deal.name} sources={sourcesWithAnalysis} /> : undefined}
            >
              <DealEntriesList sources={sourcesWithAnalysis} dealId={deal.id} />
            </WorkspacePanel>

            {/* Files */}
            <DealFilesPanel
              isConnected={isDriveConnected}
              dealFolderId={deal.google_drive_folder_id}
              files={syncedDriveFiles}
              fileAnalyses={[]}
              dealId={deal.id}
            />
          </div>

          {/* Right column — sticky panels; on mobile appears first */}
          <div className="flex flex-col gap-5 lg:sticky lg:top-20 order-1 lg:order-2">
            {/* Phase 3 score panel — shown when an opinion exists */}
            <DealScorePanel
              dealId={deal.id}
              opinion={latestOpinion}
              delta={latestDelta}
              hasEntries={sources.length > 0}
            />

            {/* Legacy intelligence panel — shown when no opinion yet */}
            {!latestOpinion && (
              <DealIntelligencePanel
                analyses={analyses}
                changeLog={changeLog}
                latestInsight={latestInsight}
              />
            )}

            {/* Change log is always shown */}
            {latestOpinion && (
              <DealIntelligencePanel
                analyses={[]}
                changeLog={changeLog}
                latestInsight={null}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
