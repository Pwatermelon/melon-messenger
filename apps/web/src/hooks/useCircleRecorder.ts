import { useState, useRef, useCallback, useEffect } from "react";
import { pickCircleMime } from "../utils/mediaMime";

const MAX_DURATION = 60;

async function getCircleStream(): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = [
    { video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } }, audio: true },
    { video: { width: { ideal: 480 }, height: { ideal: 480 } }, audio: true },
    { video: true, audio: true },
  ];
  let lastErr: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr ?? new Error("Camera unavailable");
}

export function useCircleRecorder() {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const durationRef = useRef(0);
  durationRef.current = duration;

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setPreviewStream(null);
    mediaRecorderRef.current = null;
    setRecording(false);
    setDuration(0);
    durationRef.current = 0;
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      const stream = await getCircleStream();
      streamRef.current = stream;
      setPreviewStream(stream);

      const mime = pickCircleMime();
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(250);
      setRecording(true);
      setDuration(0);
      durationRef.current = 0;
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const d = Math.floor((Date.now() - startTime) / 1000);
        durationRef.current = d;
        setDuration(d);
      }, 200);
      return true;
    } catch (err) {
      console.error("Circle recording failed:", err);
      setError(err instanceof Error ? err.message : "Не удалось открыть камеру");
      cleanup();
      return false;
    }
  }, [cleanup]);

  const stop = useCallback((): Promise<{ blob: Blob; duration: number }> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        cleanup();
        resolve({ blob: new Blob(), duration: 0 });
        return;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const d = durationRef.current;
      const mime = recorder.mimeType || pickCircleMime() || "video/webm";
      const finish = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setPreviewStream(null);
        mediaRecorderRef.current = null;
        setRecording(false);
        setDuration(0);
        durationRef.current = 0;
        resolve({ blob, duration: d });
      };
      recorder.onstop = () => {
        requestAnimationFrame(() => requestAnimationFrame(finish));
      };
      if (recorder.state === "recording") {
        recorder.requestData?.();
        recorder.stop();
      } else {
        finish();
      }
    });
  }, [cleanup]);

  const cancel = useCallback(() => {
    setError(null);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.onstop = () => cleanup();
      recorder.stop();
    } else {
      cleanup();
    }
  }, [cleanup]);

  return { recording, duration, previewStream, error, start, stop, cancel, maxDuration: MAX_DURATION };
}
