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
import DownloadEntriesButton from "@/components/DownloadEntriesButton";
import WorkspacePanel from "@/components/WorkspacePanel";
import { syncAndListDealDriveFiles } from "@/lib/google/drive";
import type {
  Deal,
  DealSource,
  DealSourceAnalysis,
  DealChangeLogItem,
  DealDriveFile,
} from "@/types";

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

  // ── Deal ──────────────────────────────────────────────────────────────────
  const { data: dealData, error: dealError } = await supabase
    .from("deals")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (dealError || !dealData) notFound();
  const deal = dealData as Deal;

  // ── Sources (newest first) ────────────────────────────────────────────────
  const { data: sourcesData } = await supabase
    .from("deal_sources")
    .select("*")
    .eq("deal_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const sources = (sourcesData ?? []) as DealSource[];

  // ── Analyses ──────────────────────────────────────────────────────────────
  const { data: analysesData } = await supabase
    .from("deal_source_analyses")
    .select("*")
    .eq("deal_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const analyses = (analysesData ?? []) as DealSourceAnalysis[];
  const analysisMap = new Map<string, DealSourceAnalysis>();
  for (const a of analyses) {
    if (!analysisMap.has(a.deal_source_id)) {
      analysisMap.set(a.deal_source_id, a);
    }
  }

  const sourcesWithAnalysis = sources.map((s) => ({
    ...s,
    analysis: analysisMap.get(s.id) ?? null,
  }));

  // ── Change log ─────────────────────────────────────────────────────────────
  const { data: changeLogData } = await supabase
    .from("deal_change_log")
    .select("*")
    .eq("deal_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const changeLog = (changeLogData ?? []) as DealChangeLogItem[];

  // ── Google Drive ──────────────────────────────────────────────────────────
  const { data: tokenRow } = await supabase
    .from("google_oauth_tokens")
    .select("id")
    .eq("user_id", user.id)
    .single();

  const isDriveConnected = !!tokenRow;

  const driveFiles = isDriveConnected
    ? (await syncAndListDealDriveFiles(user.id, id)) as DealDriveFile[]
    : [] as DealDriveFile[];

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-400 mb-4">
          <Link href="/dashboard" className="hover:text-slate-600 transition-colors">
            Dashboard
          </Link>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-slate-500 truncate max-w-[200px]">{deal.name}</span>
        </div>

        <DealHeader deal={deal} />

        {/* Add to Deal — mobile-friendly intake */}
        <div className="mb-4">
          <DealIntakeActions dealId={deal.id} isDriveConnected={isDriveConnected} />
        </div>

        {/* 2-column workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
          {/* Left column — primary actions & content */}
          <div className="flex flex-col gap-4 min-w-0">
            {/* Add Entry — primary input */}
            <WorkspacePanel id="add-entry" title="Add Entry">
              <AddDealEntryForm dealId={deal.id} />
            </WorkspacePanel>

            {/* Entries list */}
            <WorkspacePanel
              title="Entries"
              subtitle={sources.length > 0 ? `${sources.length} entr${sources.length === 1 ? "y" : "ies"}` : undefined}
              action={sources.length > 0 ? <DownloadEntriesButton dealName={deal.name} sources={sourcesWithAnalysis} /> : undefined}
            >
              <DealEntriesList sources={sourcesWithAnalysis} />
            </WorkspacePanel>

            {/* Files — below entries */}
            <DealFilesPanel
              isConnected={isDriveConnected}
              dealFolderId={deal.google_drive_folder_id}
              files={driveFiles}
              fileAnalyses={[]}
              dealId={deal.id}
            />
          </div>

          {/* Right column — intelligence & supporting info */}
          <div className="flex flex-col gap-4 lg:sticky lg:top-20">
            <DealIntelligencePanel analyses={analyses} changeLog={changeLog} />
          </div>
        </div>
      </main>
    </div>
  );
}
