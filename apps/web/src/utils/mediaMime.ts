export function extFromBlobType(mime: string, kind: "audio" | "video"): string {
  const base = mime.split(";")[0].trim().toLowerCase();
  if (base.includes("mp4") || base.includes("aac")) return kind === "audio" ? "m4a" : "mp4";
  if (base.includes("ogg")) return "ogg";
  if (base.includes("mpeg")) return "mp3";
  return kind === "audio" ? "webm" : "webm";
}

export function pickVoiceMime(): string {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

export function pickCircleMime(): string {
  const types = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
    "video/mp4;codecs=avc1",
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}
