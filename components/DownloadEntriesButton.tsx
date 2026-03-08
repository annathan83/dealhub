"use client";

import * as XLSX from "xlsx";
import type { DealSource, DealSourceAnalysis } from "@/types";

const TYPE_LABELS: Record<string, string> = {
  listing: "Listing",
  broker_email: "Broker Email",
  financial_summary: "Financial",
  note: "Note",
  unknown: "Entry",
};

function extractFileName(content: string): string | null {
  const match = content.match(/^\[File:\s*(.+?)\]/);
  return match ? match[1].trim() : null;
}

function contentFallback(content: string): string {
  const stripped = content.replace(/^\[File:[^\]]+\]\s*/i, "").trim();
  if (!stripped) return "";
  return stripped.length > 200 ? stripped.slice(0, 200).trimEnd() + "…" : stripped;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type SourceWithAnalysis = DealSource & { analysis: DealSourceAnalysis | null };

type Props = {
  dealName: string;
  sources: SourceWithAnalysis[];
};

export default function DownloadEntriesButton({ dealName, sources }: Props) {
  if (sources.length === 0) return null;

  function handleDownload() {
    const rows = sources.map((source) => {
      const fileName = extractFileName(source.content);
      const isFileEntry = !!fileName;
      const type = isFileEntry ? "New File" : (TYPE_LABELS[source.analysis?.detected_type ?? "unknown"] ?? "Entry");
      const title = isFileEntry ? fileName : (source.analysis?.generated_title ?? source.title ?? "Untitled Entry");
      const summary = isFileEntry ? "" : (source.analysis?.summary ?? contentFallback(source.content));

      return {
        Type: type,
        Title: title,
        Summary: summary,
        Date: formatDate(source.created_at),
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Entries");

    const slug = dealName.replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 40);
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${slug}_entries_${dateStr}.xlsx`);
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Download Excel
    </button>
  );
}
