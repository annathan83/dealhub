"use client";

import type { EntityFileWithText } from "@/types/entity";

type Props = {
  files: EntityFileWithText[];
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ mimeType }: { mimeType: string | null }) {
  const mime = mimeType ?? "";
  if (mime.startsWith("image/")) {
    return (
      <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }
  if (mime.startsWith("audio/")) {
    return (
      <div className="w-8 h-8 rounded-lg bg-pink-100 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-pink-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      </div>
    );
  }
  if (mime.includes("pdf")) {
    return (
      <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </div>
    );
  }
  if (mime.includes("spreadsheet") || mime.includes("excel") || mime.includes("csv")) {
    return (
      <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 14h18M10 3v18M14 3v18M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
        </svg>
      </div>
    );
  }
  if (mime === "text/plain" || mime.includes("text")) {
    return (
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
      <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    </div>
  );
}

function ExtractionStatusBadge({ file }: { file: EntityFileWithText }) {
  const status = file.file_text?.extraction_status;
  if (!status || status === "pending") {
    return <span className="text-[10px] text-slate-400">Pending</span>;
  }
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Text extracted · {file.chunk_count} chunk{file.chunk_count !== 1 ? "s" : ""}
      </span>
    );
  }
  if (status === "skipped") {
    return <span className="text-[10px] text-slate-400">No text (image/audio)</span>;
  }
  if (status === "failed") {
    return <span className="text-[10px] text-red-500">Extraction failed</span>;
  }
  return null;
}

export default function FilesTab({ files }: Props) {
  if (files.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </div>
        <p className="text-slate-500 text-sm font-medium">No files yet</p>
        <p className="text-slate-400 text-xs mt-1">
          Uploaded files will appear here with extraction status.
        </p>
      </div>
    );
  }

  const uploadedFiles = files.filter((f) => f.source_type !== "pasted_text");
  const textEntries = files.filter((f) => f.source_type === "pasted_text");

  return (
    <div className="space-y-4">
      {uploadedFiles.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Uploaded Files ({uploadedFiles.length})
          </h3>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="flex items-center gap-3 px-4 py-3">
                <FileTypeIcon mimeType={file.mime_type} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{file.file_name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <ExtractionStatusBadge file={file} />
                    {file.file_size_bytes && (
                      <span className="text-[10px] text-slate-400">
                        {formatBytes(file.file_size_bytes)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs text-slate-400">{formatDate(file.uploaded_at)}</div>
                  {file.document_type && (
                    <div className="text-[10px] text-indigo-500 mt-0.5">{file.document_type}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {textEntries.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Text Entries ({textEntries.length})
          </h3>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            {textEntries.map((file) => (
              <div key={file.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                  <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-800 truncate">{file.file_name}</div>
                  <div className="mt-0.5">
                    <ExtractionStatusBadge file={file} />
                  </div>
                </div>
                <div className="text-xs text-slate-400 shrink-0">{formatDate(file.uploaded_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
