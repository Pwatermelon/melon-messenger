import { useState, useRef, useCallback } from "react";
import { isSafariBrowser, pickVoiceMime } from "../utils/mediaMime";

const BAR_COUNT = 14;
const LEVEL_UPDATE_MS = 80;
const SAFARI_STOP_FLUSH_MS = 150;

const VOICE_CONSTRAINTS: MediaStreamConstraints = {
  audio: {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
  },
};

function idleLevels(): number[] {
  return Array.from({ length: BAR_COUNT }, () => 0.15);
}

async function waitForLiveAudioTrack(stream: MediaStream, timeoutMs = 600): Promise<void> {
  const track = stream.getAudioTracks()[0];
  if (!track) return;
  if (track.readyState === "live" && track.enabled && !track.muted) return;
  await new Promise<void>((resolve) => {
    const done = () => {
      track.removeEventListener("unmute", onUnmute);
      clearTimeout(timer);
      resolve();
    };
    const onUnmute = () => done();
    track.addEventListener("unmute", onUnmute);
    const timer = setTimeout(done, timeoutMs);
  });
}

export function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [levels, setLevels] = useState<number[]>(idleLevels);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const analysisStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastLevelUpdateRef = useRef(0);
  const acquiredStreamRef = useRef<MediaStream | null>(null);

  const stopAnalyser = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    analyserRef.current = null;
    const ctx = audioContextRef.current;
    audioContextRef.current = null;
    if (ctx) void ctx.close().catch(() => {});
    analysisStreamRef.current?.getTracks().forEach((t) => t.stop());
    analysisStreamRef.current = null;
    setLevels(idleLevels());
  }, []);

  const startAnalyser = useCallback((stream: MediaStream) => {
    stopAnalyser();
    analysisStreamRef.current = stream;
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.72;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);
    audioContextRef.current = ctx;
    analyserRef.current = analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      const node = analyserRef.current;
      if (!node) return;
      node.getByteFrequencyData(data);
      const step = Math.max(1, Math.floor(data.length / BAR_COUNT));
      const next = Array.from({ length: BAR_COUNT }, (_, i) => {
        let sum = 0;
        const start = i * step;
        for (let j = 0; j < step; j++) sum += data[start + j] ?? 0;
        const avg = sum / step / 255;
        return 0.14 + Math.min(1, avg * 2.4);
      });
      const now = performance.now();
      if (now - lastLevelUpdateRef.current >= LEVEL_UPDATE_MS) {
        lastLevelUpdateRef.current = now;
        setLevels(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    void ctx.resume().then(() => {
      rafRef.current = requestAnimationFrame(tick);
    });
  }, [stopAnalyser]);

  const releaseAcquire = useCallback(() => {
    if (mediaRecorderRef.current) return;
    acquiredStreamRef.current?.getTracks().forEach((t) => t.stop());
    acquiredStreamRef.current = null;
  }, []);

  const acquire = useCallback(async (): Promise<boolean> => {
    if (mediaRecorderRef.current || acquiredStreamRef.current) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia(VOICE_CONSTRAINTS);
      acquiredStreamRef.current = stream;
      return true;
    } catch (err) {
      console.error("Voice acquire failed:", err);
      return false;
    }
  }, []);

  const begin = useCallback(async (): Promise<boolean> => {
    if (mediaRecorderRef.current) return true;
    try {
      let stream = acquiredStreamRef.current;
      if (!stream) {
        const ok = await acquire();
        if (!ok) return false;
        stream = acquiredStreamRef.current;
      }
      if (!stream) return false;
      acquiredStreamRef.current = null;

      await waitForLiveAudioTrack(stream);
      const mime = pickVoiceMime();
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 128_000 })
        : new MediaRecorder(stream, { audioBitsPerSecond: 128_000 });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      mediaRecorderRef.current = recorder;
      if (isSafariBrowser()) recorder.start();
      else recorder.start(250);

      const analysisStream = typeof stream.clone === "function" ? stream.clone() : stream;
      startAnalyser(analysisStream);

      const startTime = Date.now();
      startTimeRef.current = startTime;
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => {
        const d = Math.max(0, Math.floor((Date.now() - startTime) / 1000));
        setDuration(d);
      }, 200);
      return true;
    } catch (err) {
      console.error("Voice recording failed:", err);
      stopAnalyser();
      releaseAcquire();
      return false;
    }
  }, [acquire, releaseAcquire, startAnalyser, stopAnalyser]);

  const start = useCallback(async (): Promise<boolean> => {
    const ok = await acquire();
    if (!ok) return false;
    return begin();
  }, [acquire, begin]);

  const stop = useCallback((): Promise<{ blob: Blob; duration: number }> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      const startedAt = startTimeRef.current;
      if (!recorder || recorder.state === "inactive") {
        stopAnalyser();
        releaseAcquire();
        startTimeRef.current = null;
        resolve({ blob: new Blob(), duration: 0 });
        return;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      const wallDuration = startedAt
        ? Math.max(1, Math.round((Date.now() - startedAt) / 1000))
        : 1;
      const mime = recorder.mimeType || "audio/webm";
      let finalized = false;
      const finish = () => {
        if (finalized) return;
        finalized = true;
        stopAnalyser();
        recorder.stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        setDuration(0);
        mediaRecorderRef.current = null;
        startTimeRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mime });
        resolve({ blob, duration: wallDuration });
      };
      recorder.onstop = () => {
        const delay = isSafariBrowser() ? SAFARI_STOP_FLUSH_MS : 0;
        if (delay) setTimeout(finish, delay);
        else requestAnimationFrame(() => requestAnimationFrame(finish));
      };
      if (recorder.state === "recording") {
        try {
          recorder.requestData();
        } catch {
          // ignore
        }
        recorder.stop();
      } else {
        finish();
      }
    });
  }, [releaseAcquire, stopAnalyser]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    stopAnalyser();
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.onstop = null;
      if (recorder.state !== "inactive") recorder.stop();
      recorder.stream.getTracks().forEach((t) => t.stop());
    } else {
      releaseAcquire();
    }
    chunksRef.current = [];
    mediaRecorderRef.current = null;
    startTimeRef.current = null;
    setRecording(false);
    setDuration(0);
  }, [releaseAcquire, stopAnalyser]);

  return { recording, duration, levels, acquire, begin, releaseAcquire, start, stop, cancel };
}
