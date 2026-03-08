"use client";

import { useRef, useEffect, useState } from "react";
import { getPreferredAudioDeviceId } from "@/lib/media-devices";

type Props = {
  onCapture: (file: File) => void;
  onClose: () => void;
  onError?: (message: string) => void;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AudioRecordModal({ onCapture, onClose, onError }: Props) {
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [status, setStatus] = useState<"loading" | "ready" | "recording" | "stopping">("loading");
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    let mounted = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function startMic() {
      try {
        const deviceId = await getPreferredAudioDeviceId();
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: deviceId ? { deviceId: { exact: deviceId } } : true,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        setStatus("ready");
      } catch (e) {
        if (!mounted) return;
        const msg = e instanceof Error ? e.message : "Could not access microphone.";
        setError(msg);
        onError?.(msg);
      }
    }

    startMic();
    return () => {
      mounted = false;
      if (timer) clearInterval(timer);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
      recorderRef.current = null;
    };
  }, [onError]);

  useEffect(() => {
    if (status !== "recording") return;
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(timer);
  }, [status]);

  function handleStart() {
    const stream = streamRef.current;
    if (!stream || status !== "ready") return;

    chunksRef.current = [];
    setDuration(0);

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

    const recorder = new MediaRecorder(stream, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      const ext = blob.type.includes("webm") ? "webm" : "mp4";
      const file = new File([blob], `recording.${ext}`, { type: blob.type });
      onCapture(file);
      onClose();
    };

    recorder.start();
    setStatus("recording");
  }

  function handleStop() {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    setStatus("stopping");
    recorder.stop();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900">Record Audio</h3>
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

        <div className="p-6">
          {error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <p className="text-sm text-slate-600">{error}</p>
              <p className="text-xs text-slate-400">
                Use &quot;Upload File&quot; to select an audio file from your device instead.
              </p>
            </div>
          ) : (
            <>
              {status === "loading" && (
                <div className="flex flex-col items-center justify-center gap-4 py-8">
                  <svg className="w-10 h-10 text-indigo-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                  <p className="text-sm text-slate-500">Requesting microphone access…</p>
                </div>
              )}

              {(status === "ready" || status === "recording" || status === "stopping") && (
                <div className="flex flex-col items-center gap-6">
                  <div className="flex items-center justify-center w-20 h-20 rounded-full bg-violet-100">
                    {status === "recording" ? (
                      <span className="flex gap-1">
                        <span className="w-2 h-8 bg-violet-600 rounded-full animate-pulse" style={{ animationDelay: "0ms" }} />
                        <span className="w-2 h-8 bg-violet-600 rounded-full animate-pulse" style={{ animationDelay: "150ms" }} />
                        <span className="w-2 h-8 bg-violet-600 rounded-full animate-pulse" style={{ animationDelay: "300ms" }} />
                      </span>
                    ) : (
                      <svg className="w-10 h-10 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-4a4 4 0 01-8 0V9a4 4 0 018 0z" />
                      </svg>
                    )}
                  </div>

                  {status === "recording" && (
                    <p className="text-2xl font-mono font-medium text-slate-700 tabular-nums">
                      {formatDuration(duration)}
                    </p>
                  )}

                  <p className="text-sm text-slate-500 text-center">
                    {status === "ready" && "Click Start to begin recording."}
                    {status === "recording" && "Recording… Click Stop when done."}
                    {status === "stopping" && "Saving…"}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {!error && status !== "loading" && (
          <div className="flex gap-3 p-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            {status === "ready" && (
              <button
                type="button"
                onClick={handleStart}
                className="flex-1 rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors"
              >
                Start
              </button>
            )}
            {status === "recording" && (
              <button
                type="button"
                onClick={handleStop}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
              >
                Stop
              </button>
            )}
            {status === "stopping" && (
              <button
                type="button"
                disabled
                className="flex-1 rounded-lg bg-slate-300 px-4 py-2.5 text-sm font-semibold text-white cursor-not-allowed"
              >
                Saving…
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
