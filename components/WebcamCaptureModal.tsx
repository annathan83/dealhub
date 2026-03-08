"use client";

import { useRef, useEffect, useState } from "react";
import { getPreferredVideoDeviceId } from "@/lib/media-devices";

export type CaptureMode = "photo" | "document";

type Props = {
  onCapture: (files: File[]) => void;
  onClose: () => void;
  onError?: (message: string) => void;
};

export default function WebcamCaptureModal({ onCapture, onClose, onError }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "capturing">("loading");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<CaptureMode>("photo");
  const [captured, setCaptured] = useState<File[]>([]);

  useEffect(() => {
    let mounted = true;

    async function startCamera() {
      try {
        const deviceId = await getPreferredVideoDeviceId();
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: false,
          });
        }

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setStatus("ready");
      } catch (e) {
        if (!mounted) return;
        const msg = e instanceof Error ? e.message : "Could not access camera.";
        setError(msg);
        onError?.(msg);
      }
    }

    startCamera();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [onError]);

  function handleCapture() {
    const video = videoRef.current;
    if (!video || !streamRef.current || status !== "ready") return;

    setStatus("capturing");

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setStatus("ready");
      return;
    }

    ctx.drawImage(video, 0, 0);

    const baseName = mode === "document" ? "document" : "photo";
    const quality = mode === "document" ? 0.98 : 0.9;

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setStatus("ready");
          return;
        }
        const n = captured.length + 1;
        const fileName = n === 1 ? `${baseName}.jpg` : `${baseName}_${n}.jpg`;
        const file = new File([blob], fileName, { type: "image/jpeg" });
        setCaptured((prev) => [...prev, file]);
        setStatus("ready");
      },
      "image/jpeg",
      quality
    );
  }

  function handleDone() {
    if (captured.length > 0) {
      onCapture(captured);
    }
    onClose();
  }

  function removeAt(index: number) {
    setCaptured((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Take Picture</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Mode selector */}
        {!error && (
          <div className="flex gap-2 px-4 pt-3">
            <button
              type="button"
              onClick={() => setMode("photo")}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                mode === "photo"
                  ? "bg-amber-100 text-amber-800 border border-amber-200"
                  : "bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100"
              }`}
            >
              Photo
            </button>
            <button
              type="button"
              onClick={() => setMode("document")}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                mode === "document"
                  ? "bg-indigo-100 text-indigo-800 border border-indigo-200"
                  : "bg-slate-50 text-slate-600 border border-slate-100 hover:bg-slate-100"
              }`}
            >
              Document scan
            </button>
          </div>
        )}

        <div className="relative aspect-[4/3] bg-slate-900">
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-slate-300">{error}</p>
              <p className="text-xs text-slate-400">
                Use &quot;Upload File&quot; to select an image from your device instead.
              </p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {status === "loading" && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60">
                  <svg className="w-10 h-10 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                </div>
              )}
            </>
          )}
        </div>

        {/* Captured thumbnails */}
        {captured.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 mb-2">{captured.length} captured</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {captured.map((file, i) => (
                <div key={i} className="relative shrink-0">
                  <img
                    src={URL.createObjectURL(file)}
                    alt={`Capture ${i + 1}`}
                    className="w-14 h-14 object-cover rounded-lg border border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {!error && (
          <div className="flex gap-3 p-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCapture}
              disabled={status !== "ready"}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {status === "capturing" ? "Saving…" : "Capture"}
            </button>
            <button
              type="button"
              onClick={handleDone}
              disabled={captured.length === 0}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Done ({captured.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
