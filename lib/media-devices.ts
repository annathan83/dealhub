/**
 * Prefer built-in laptop camera and microphone on desktop, excluding Windows Link / Phone Link.
 * On mobile: use phone camera and mic (no filtering).
 */

const EXCLUDE_PATTERN = /link|phone|remote|wireless|camera app|phone link|windows link/i;
const PREFER_PATTERN = /integrated|built-in|internal|webcam|truevision|realtek|array mic/i;

function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

async function ensureLabelsPopulated(kind: "video" | "audio"): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(
      kind === "video" ? { video: true } : { audio: true }
    );
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    // Permission denied - enumerate will still run but labels may be empty
  }
}

export async function getPreferredVideoDeviceId(): Promise<string | undefined> {
  if (isMobile()) return undefined; // Use phone camera (default)
  await ensureLabelsPopulated("video");
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoInputs = devices.filter((d) => d.kind === "videoinput");

  // Prefer devices that look built-in
  const preferred = videoInputs.find(
    (d) => d.label && PREFER_PATTERN.test(d.label) && !EXCLUDE_PATTERN.test(d.label)
  );
  if (preferred) return preferred.deviceId;

  // Exclude Link/Phone, use first remaining
  const builtIn = videoInputs.find((d) => d.label && !EXCLUDE_PATTERN.test(d.label));
  if (builtIn) return builtIn.deviceId;

  return videoInputs[0]?.deviceId;
}

export async function getPreferredAudioDeviceId(): Promise<string | undefined> {
  if (isMobile()) return undefined; // Use phone mic (default)
  await ensureLabelsPopulated("audio");
  const devices = await navigator.mediaDevices.enumerateDevices();
  const audioInputs = devices.filter((d) => d.kind === "audioinput");

  const preferred = audioInputs.find(
    (d) => d.label && PREFER_PATTERN.test(d.label) && !EXCLUDE_PATTERN.test(d.label)
  );
  if (preferred) return preferred.deviceId;

  const builtIn = audioInputs.find((d) => d.label && !EXCLUDE_PATTERN.test(d.label));
  if (builtIn) return builtIn.deviceId;

  return audioInputs[0]?.deviceId;
}
