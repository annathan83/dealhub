"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { GoogleDriveConnection } from "@/types";

function GoogleDriveIcon() {
  return (
    <svg className="w-6 h-6" viewBox="0 0 87.3 78" aria-hidden="true">
      <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0a15.92 15.92 0 001.65 7.2z" fill="#0066da" />
      <path d="M43.65 25L29.9 1.2a9.5 9.5 0 00-3.3 3.3L1.65 49.4A16 16 0 000 56.6h27.5z" fill="#00ac47" />
      <path d="M73.55 76.8a9.5 9.5 0 003.3-3.3l1.6-2.75 7.65-13.25a16 16 0 001.65-7.2H60.5l5.85 11.2z" fill="#ea4335" />
      <path d="M43.65 25L57.4 1.2A16.27 16.27 0 0050.2 0H37.1a16.27 16.27 0 00-7.2 1.2z" fill="#00832d" />
      <path d="M60.5 56.6H27.5L13.75 80.1a16.27 16.27 0 007.2 1.2h45.9a16.27 16.27 0 007.2-1.2z" fill="#2684fc" />
      <path d="M73.4 26.35l-13.2-22.85a9.5 9.5 0 00-3.3-3.3L43.65 25l16.85 31.6H87.3a16 16 0 00-1.65-7.2z" fill="#ffba00" />
    </svg>
  );
}

export default function ConnectGoogleDriveCard({
  connection,
}: {
  connection: GoogleDriveConnection | null;
}) {
  const router = useRouter();
  const isConnected = !!connection;
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/google/disconnect", { method: "POST" });
      router.refresh();
    } finally {
      setDisconnecting(false);
      setConfirmDisconnect(false);
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="flex items-start gap-4 px-6 py-5 border-b border-slate-100">
        <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-slate-50 border border-slate-100 shrink-0">
          <GoogleDriveIcon />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-sm font-semibold text-slate-900">Google Drive</h2>
            {isConnected ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                Not connected
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            DealHub stores raw deal artifacts in your connected Google Drive. Each deal gets its own folder inside a top-level <strong>DealHub</strong> folder.
          </p>
        </div>
      </div>

      {/* Card body */}
      <div className="px-6 py-5">
        {isConnected ? (
          <div className="flex flex-col gap-4">
            {connection.google_email && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                </svg>
                <span>
                  Connected as{" "}
                  <span className="font-medium text-slate-800">{connection.google_email}</span>
                </span>
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href="/api/google/connect?returnTo=/settings/integrations"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Reconnect
              </Link>

              {!confirmDisconnect ? (
                <button
                  type="button"
                  onClick={() => setConfirmDisconnect(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-100 bg-white px-4 py-2 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                >
                  Disconnect
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Remove Drive connection?</span>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-60 transition-colors"
                  >
                    {disconnecting ? "Removing…" : "Yes, disconnect"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnect(false)}
                    className="inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                <strong className="text-slate-700">What gets stored:</strong> When you upload files or add entries to a deal, they are saved in that deal&apos;s Google Drive folder. DealHub only stores files it creates — it cannot access other files in your Drive.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-2">
              {[
                "A DealHub folder is created in your Google Drive",
                "Each deal gets its own subfolder",
                "Uploaded files and pasted entries are saved automatically",
                "DealHub only accesses files it creates (drive.file scope)",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-slate-600">
                  <svg className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/api/google/connect?returnTo=/settings/integrations"
              className="self-start inline-flex items-center gap-2.5 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
            >
              <GoogleDriveIcon />
              Connect Google Drive
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
