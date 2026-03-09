"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EntityFile } from "@/types/entity";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  pasted_text:    "Note",
  uploaded_file:  "File",
  uploaded_image: "Image",
  webcam_photo:   "Photo",
  audio_recording:"Audio",
  broker_listing: "Listing",
  broker_email:   "Email",
  manual:         "File",
};

const SOURCE_TYPE_STYLES: Record<string, string> = {
  pasted_text:    "bg-slate-100 text-slate-500 border-slate-200",
  uploaded_file:  "bg-violet-50 text-violet-700 border-violet-100",
  uploaded_image: "bg-purple-50 text-purple-700 border-purple-100",
  webcam_photo:   "bg-purple-50 text-purple-700 border-purple-100",
  audio_recording:"bg-teal-50 text-teal-700 border-teal-100",
  broker_listing: "bg-blue-50 text-blue-600 border-blue-100",
  broker_email:   "bg-amber-50 text-amber-700 border-amber-100",
  manual:         "bg-violet-50 text-violet-700 border-violet-100",
};

const SOURCE_TYPE_ICON_BG: Record<string, string> = {
  pasted_text:    "bg-slate-100",
  uploaded_file:  "bg-violet-100",
  uploaded_image: "bg-purple-100",
  webcam_photo:   "bg-purple-100",
  audio_recording:"bg-teal-100",
  broker_listing: "bg-blue-100",
  broker_email:   "bg-amber-100",
  manual:         "bg-violet-100",
};

const SOURCE_TYPE_ICON_COLOR: Record<string, string> = {
  pasted_text:    "text-slate-500",
  uploaded_file:  "text-violet-600",
  uploaded_image: "text-purple-600",
  webcam_photo:   "text-purple-600",
  audio_recording:"text-teal-600",
  broker_listing: "text-blue-600",
  broker_email:   "text-amber-600",
  manual:         "text-violet-600",
};

function TypeIcon({ sourceType }: { sourceType: string | null }) {
  const t = sourceType ?? "pasted_text";

  if (t === "broker_listing") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  }
  if (t === "broker_email") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    );
  }
  if (t === "uploaded_file" || t === "manual") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
      </svg>
    );
  }
  if (t === "uploaded_image" || t === "webcam_photo") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    );
  }
  if (t === "audio_recording") {
    return (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-4a4 4 0 01-8 0V9a4 4 0 018 0z" />
      </svg>
    );
  }
  // pasted_text / default
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

type Props = {
  files: EntityFile[];
  dealId: string;
};

function EntryCard({
  file,
  dealId,
  isLast,
}: {
  file: EntityFile;
  dealId: string;
  isLast: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const sourceType = file.source_type ?? "pasted_text";
  const typeLabel = SOURCE_TYPE_LABELS[sourceType] ?? "Entry";
  const typeStyle = SOURCE_TYPE_STYLES[sourceType] ?? SOURCE_TYPE_STYLES.pasted_text;
  const iconBg = SOURCE_TYPE_ICON_BG[sourceType] ?? SOURCE_TYPE_ICON_BG.pasted_text;
  const iconColor = SOURCE_TYPE_ICON_COLOR[sourceType] ?? SOURCE_TYPE_ICON_COLOR.pasted_text;

  const isTextEntry = file.metadata_json?.is_text_entry === true || sourceType === "pasted_text";
  const displayTitle = file.title ?? file.file_name;
  const bodyText = file.summary ?? null;

  function handleDelete() {
    startTransition(async () => {
      await fetch(`/api/deals/${dealId}/entries/${file.id}`, { method: "DELETE" });
      router.refresh();
    });
  }

  return (
    <div className="relative flex gap-4 pb-4 last:pb-0">
      {/* Timeline dot / icon + connecting line */}
      <div className="relative flex-shrink-0 flex flex-col items-center">
        <div className={`relative z-10 w-10 h-10 rounded-full flex items-center justify-center border-2 border-white shadow-sm ${iconBg} ${iconColor}`}>
          <TypeIcon sourceType={sourceType} />
        </div>
        {!isLast && (
          <div className="flex-1 w-px bg-slate-100 mt-1" />
        )}
      </div>

      {/* Card */}
      <div className="flex-1 min-w-0 rounded-xl border border-slate-100 bg-white shadow-sm px-4 py-3 hover:shadow-md transition-shadow">
        <div className="flex items-start justify-between gap-3 mb-1.5">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeStyle}`}>
              {typeLabel}
            </span>
            <span className="text-sm font-semibold text-slate-800 leading-snug truncate">
              {displayTitle ? (
                displayTitle
              ) : (
                <span className="text-slate-400 font-normal italic text-xs">Untitled Entry</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-400 whitespace-nowrap pt-px tabular-nums">
              {formatDate(file.uploaded_at)}
            </span>
            {/* Delete button — only for text entries */}
            {isTextEntry && (
              !confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={isPending}
                  className="p-1 rounded text-slate-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
                  title="Delete entry"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleDelete}
                    disabled={isPending}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-60 transition-colors"
                  >
                    {isPending ? "…" : "Delete"}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={isPending}
                    className="px-2 py-0.5 rounded text-[10px] font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    Keep
                  </button>
                </div>
              )
            )}
          </div>
        </div>

        {bodyText && (
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
            {bodyText}
          </p>
        )}

        {!isTextEntry && file.file_name && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-slate-50 border border-slate-100 px-2 py-1">
            <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
            <span className="text-[10px] text-slate-500 font-medium truncate max-w-[200px]">{file.file_name}</span>
          </div>
        )}

        {file.web_view_link && (
          <div className="mt-2">
            <a
              href={file.web_view_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700 transition-colors"
            >
              Open in Drive
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DealEntriesList({ files, dealId }: Props) {
  if (files.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3">
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-slate-500">No entries yet</p>
        <p className="text-xs text-slate-400">Add a note, photo, or file to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0">
      {files.map((file, idx) => (
        <EntryCard
          key={file.id}
          file={file}
          dealId={dealId}
          isLast={idx === files.length - 1}
        />
      ))}
    </div>
  );
}
