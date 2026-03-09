import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import AddDealEntryForm from "@/components/AddDealEntryForm";
import DealEntriesList from "@/components/DealEntriesList";
import DealFilesPanel from "@/components/DealFilesPanel";
import DealHeader from "@/components/DealHeader";
import DealIntakeActions from "@/components/DealIntakeActions";
import DealScorePanel from "@/components/DealScorePanel";
import ChangeLogPanel from "@/components/ChangeLogPanel";
import DownloadEntriesButton from "@/components/DownloadEntriesButton";
import WorkspacePanel from "@/components/WorkspacePanel";
import EntityDetailTabs from "@/components/entity/EntityDetailTabs";
import { syncAndListDealDriveFiles } from "@/lib/google/drive";
import { buildDealPageViewModel } from "@/lib/db/dealViewModel";

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

  const { deal, sources, analyses, changeLog, driveFiles, entityData, kpiScorecard } = vm;

  const analysisMap = new Map(analyses.map((a) => [a.deal_source_id, a]));
  const sourcesWithAnalysis = sources.map((s) => ({ ...s, analysis: analysisMap.get(s.id) ?? null }));

  const { data: tokenRow } = await supabase
    .from("google_oauth_tokens")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const isDriveConnected = !!tokenRow;

  const syncedDriveFiles = isDriveConnected
    ? await syncAndListDealDriveFiles(user.id, id).catch(() => driveFiles)
    : driveFiles;

  // Latest deal_assessment snapshot for the score panel
  const latestAssessmentSnapshot =
    entityData?.analysis_snapshots.find((s) => s.analysis_type === "deal_assessment") ?? null;

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 pb-28 sm:pb-16">

        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 hover:text-indigo-600 transition-colors font-medium"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Pipeline
          </Link>
          <svg className="w-3 h-3 text-slate-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-600 font-medium truncate">{deal.name}</span>
        </div>

        {/* Deal identity + key metrics */}
        <DealHeader deal={deal} />

        {/* ── 4-Layer Architecture Tabs ─────────────────────────────────────────
            Facts / KPI Score / AI Analysis / Files / History
            This is the primary content area for the new architecture. */}
        {entityData && (
          <EntityDetailTabs
            data={entityData}
            scorecard={kpiScorecard}
            dealId={deal.id}
          />
        )}

        {/* Add information actions */}
        <DealIntakeActions dealId={deal.id} isDriveConnected={isDriveConnected} />

        {/* 2-column workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">

          {/* Left column — timeline + file list */}
          <div className="flex flex-col gap-4 min-w-0 order-2 lg:order-1">
            <WorkspacePanel id="add-entry" title="Paste Text">
              <AddDealEntryForm dealId={deal.id} />
            </WorkspacePanel>

            <WorkspacePanel
              title="Timeline"
              subtitle={sources.length > 0 ? `${sources.length} entr${sources.length === 1 ? "y" : "ies"}` : undefined}
              action={sources.length > 0 ? <DownloadEntriesButton dealName={deal.name} sources={sourcesWithAnalysis} /> : undefined}
            >
              <DealEntriesList sources={sourcesWithAnalysis} dealId={deal.id} />
            </WorkspacePanel>

            <DealFilesPanel
              isConnected={isDriveConnected}
              dealFolderId={deal.google_drive_folder_id}
              files={syncedDriveFiles}
              dealId={deal.id}
            />
          </div>

          {/* Right column — AI score + activity log */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-20 order-1 lg:order-2">
            <DealScorePanel
              dealId={deal.id}
              snapshot={latestAssessmentSnapshot}
              hasEntries={sources.length > 0}
            />
            <ChangeLogPanel changeLog={changeLog} />
          </div>
        </div>
      </main>
    </div>
  );
}
