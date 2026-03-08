import type { DealDriveFile } from "@/types";
import { getDriveFolderUrl } from "@/lib/google/drive";
import FileUploadForm from "./FileUploadForm";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

/** Distinct colored icon per file type — immediately recognisable */
function FileIcon({ name }: { name: string }) {
  const ext = getExt(name);

  // PDF — red document with folded corner
  if (ext === "pdf") {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-red-50 border border-red-100 shrink-0">
        <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </span>
    );
  }

  // Word — blue
  if (ext === "doc" || ext === "docx") {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-blue-50 border border-blue-100 shrink-0">
        <svg className="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </span>
    );
  }

  // Excel / CSV — green table icon
  if (ext === "xls" || ext === "xlsx" || ext === "csv") {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-green-50 border border-green-100 shrink-0">
        <svg className="w-3.5 h-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M3 6a3 3 0 013-3h12a3 3 0 013 3v12a3 3 0 01-3 3H6a3 3 0 01-3-3V6z" />
        </svg>
      </span>
    );
  }

  // Images — purple photo icon
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-purple-50 border border-purple-100 shrink-0">
        <svg className="w-3.5 h-3.5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </span>
    );
  }

  // Audio — teal
  if (["mp3", "m4a", "wav", "webm", "ogg", "aac"].includes(ext)) {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-teal-50 border border-teal-100 shrink-0">
        <svg className="w-3.5 h-3.5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-4a4 4 0 01-8 0V9a4 4 0 018 0z" />
        </svg>
      </span>
    );
  }

  // TXT / plain text — slate
  if (ext === "txt") {
    return (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-slate-50 border border-slate-200 shrink-0">
        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10" />
        </svg>
      </span>
    );
  }

  // Fallback — generic document
  return (
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-slate-50 border border-slate-200 shrink-0">
      <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    </span>
  );
}

type Props = {
  isConnected: boolean;
  dealFolderId: string | null;
  files: DealDriveFile[];
  fileAnalyses: never[]; // kept for API compatibility, no longer used
  dealId: string;
};

export default function DealFilesPanel({
  isConnected,
  dealFolderId,
  files,
  dealId,
}: Props) {
  const folderUrl = dealFolderId ? getDriveFolderUrl(dealFolderId) : null;

  return (
    <div className="rounded-lg border border-slate-100 bg-white shadow-sm overflow-hidden">
      {/* Panel header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-50">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-slate-50 border border-slate-100">
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
            </svg>
          </div>
          <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Files</h3>
          {files.length > 0 && (
            <span className="text-xs text-slate-400">({files.length})</span>
          )}
        </div>

        {folderUrl && (
          <a
            href={folderUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open Folder
          </a>
        )}
      </div>

      {/* Upload form */}
      <div className="px-4 py-3 border-b border-slate-50">
        <FileUploadForm dealId={dealId} isDriveConnected={isConnected} />
      </div>

      {/* File list */}
      {files.length === 0 ? (
        <div className="px-4 py-5 text-center">
          <p className="text-xs text-slate-400">
            {isConnected
              ? "No files yet. Upload files above or add a text entry."
              : "Connect Google Drive to store and view deal files."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-50 bg-slate-50/60">
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-400 tracking-wide">
                  File
                </th>
                <th className="text-left px-4 py-2 text-xs font-medium text-slate-400 tracking-wide whitespace-nowrap">
                  Added
                </th>
                <th className="px-4 py-2 w-16" />
              </tr>
            </thead>
            <tbody>
              {files.map((file, i) => {
                const displayName = file.google_file_name;
                const isManual = file.source_kind === "manual" && !file.original_file_name;

                return (
                  <tr
                    key={file.id}
                    className={`hover:bg-slate-50 transition-colors group ${i !== files.length - 1 ? "border-b border-slate-50" : ""}`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileIcon name={displayName} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-slate-700 group-hover:text-indigo-700 transition-colors truncate max-w-[220px]">
                            {displayName}
                          </p>
                          {isManual && (
                            <p className="text-[10px] text-slate-400 mt-0.5 leading-none">
                              added manually
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 whitespace-nowrap">
                      {formatDate(file.created_time ?? file.created_at)}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {file.web_view_link ? (
                        <a
                          href={file.web_view_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-colors"
                        >
                          Open
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
