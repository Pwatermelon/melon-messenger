import { useState, useRef, useCallback, useEffect } from "react";

const MAX_DURATION = 60;

export function useCircleRecorder() {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);
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
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
        audio: true,
      });
      streamRef.current = stream;
      setPreviewStream(stream);

      const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/webm")
          ? "video/webm"
          : "video/mp4";

      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(200);
      setRecording(true);
      setDuration(0);
      durationRef.current = 0;
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const d = Math.floor((Date.now() - startTime) / 1000);
        durationRef.current = d;
        setDuration(d);
        if (d >= MAX_DURATION) {
          recorder.stop();
        }
      }, 200);
    } catch (err) {
      console.error("Circle recording failed:", err);
      cleanup();
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
      const mime = recorder.mimeType || "video/webm";
      const finish = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setPreviewStream(null);
        mediaRecorderRef.current = null;
        setRecording(false);
        setDuration(0);
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
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.onstop = () => cleanup();
      recorder.stop();
    } else {
      cleanup();
    }
  }, [cleanup]);

  return { recording, duration, previewStream, start, stop, cancel, maxDuration: MAX_DURATION };
}
