import { useState, useRef, useCallback } from "react";

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const durationRef = useRef(0);
  durationRef.current = duration;

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      recorder.start(100);
      setRecording(true);
      setDuration(0);
      durationRef.current = 0;
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        const d = Math.floor((Date.now() - startTime) / 1000);
        durationRef.current = d;
        setDuration(d);
      }, 1000);
    } catch (err) {
      console.error("Voice recording failed:", err);
    }
  }, []);

  const stop = useCallback((): Promise<{ blob: Blob; duration: number }> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve({ blob: new Blob(), duration: 0 });
        return;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const d = durationRef.current;
      const mime = recorder.mimeType || "audio/webm";
      const finish = () => {
        recorder.stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setDuration(0);
        mediaRecorderRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mime });
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
  }, []);

  return { recording, duration, start, stop };
}
