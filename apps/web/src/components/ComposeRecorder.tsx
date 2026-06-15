import { useEffect, useRef, useState } from "react";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";
import { useCircleRecorder } from "../hooks/useCircleRecorder";
import { IconCircle, IconMic } from "./Icons";

type RecordMode = "voice" | "circle";
type Gesture = "none" | "cancel" | "lock";

const HOLD_MS = 220;
const MOVE_PX = 12;

interface ComposeRecorderProps {
  disabled?: boolean;
  onVoiceSend: (blob: Blob, duration: number) => void | Promise<void>;
  onCircleSend: (blob: Blob, duration: number) => void | Promise<void>;
}

export function ComposeRecorder({ disabled, onVoiceSend, onCircleSend }: ComposeRecorderProps) {
  const voice = useVoiceRecorder();
  const circle = useCircleRecorder();
  const [mode, setMode] = useState<RecordMode>(() => {
    try {
      return localStorage.getItem("wm_record_mode") === "circle" ? "circle" : "voice";
    } catch {
      return "voice";
    }
  });
  const [locked, setLocked] = useState(false);
  const [gesture, setGesture] = useState<Gesture>("none");
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const btnRef = useRef<HTMLButtonElement>(null);
  const pointerIdRef = useRef<number | null>(null);
  const originRef = useRef({ x: 0, y: 0 });
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingStartedRef = useRef(false);
  const movedRef = useRef(false);
  const gestureRef = useRef<Gesture>("none");
  const previewRef = useRef<HTMLVideoElement>(null);
  const sendingRef = useRef(false);

  const activeMode = mode;
  const recording = activeMode === "voice" ? voice.recording : circle.recording;
  const duration = activeMode === "voice" ? voice.duration : circle.duration;
  const maxDuration = circle.maxDuration;
  const active = recording || locked;

  useEffect(() => {
    gestureRef.current = gesture;
  }, [gesture]);

  useEffect(() => {
    const el = previewRef.current;
    if (el && circle.previewStream) {
      el.srcObject = circle.previewStream;
      el.play().catch(() => {});
    }
  }, [circle.previewStream]);

  useEffect(() => {
    if (activeMode === "circle" && circle.recording && circle.duration >= maxDuration) {
      void finishSend();
    }
  }, [activeMode, circle.recording, circle.duration, maxDuration]);

  function persistMode(next: RecordMode) {
    setMode(next);
    try {
      localStorage.setItem("wm_record_mode", next);
    } catch {}
  }

  function updateAnchor() {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    setAnchor({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
  }

  async function finishSend() {
    if (sendingRef.current) return;
    sendingRef.current = true;
    const isVoice = activeMode === "voice";
    const { blob, duration: d } = isVoice ? await voice.stop() : await circle.stop();
    setLocked(false);
    setGesture("none");
    setAnchor(null);
    if (isVoice && blob.size >= 200) await onVoiceSend(blob, d);
    if (!isVoice && blob.size >= 500) await onCircleSend(blob, d);
    sendingRef.current = false;
  }

  function cancelRecording() {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    voice.cancel();
    circle.cancel();
    recordingStartedRef.current = false;
    setLocked(false);
    setGesture("none");
    setAnchor(null);
  }

  async function startRecording() {
    recordingStartedRef.current = true;
    updateAnchor();
    if (activeMode === "voice") await voice.start();
    else await circle.start();
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (disabled || locked) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerIdRef.current = e.pointerId;
    originRef.current = { x: e.clientX, y: e.clientY };
    movedRef.current = false;
    recordingStartedRef.current = false;
    setGesture("none");
    holdTimerRef.current = setTimeout(() => {
      void startRecording();
    }, HOLD_MS);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const dx = e.clientX - originRef.current.x;
    const dy = e.clientY - originRef.current.y;
    if (Math.abs(dx) > MOVE_PX || Math.abs(dy) > MOVE_PX) movedRef.current = true;
    if (!recording || locked || pointerIdRef.current !== e.pointerId) return;
    if (dx < -70) setGesture("cancel");
    else if (dy < -70) setGesture("lock");
    else setGesture("none");
  }

  async function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (pointerIdRef.current !== e.pointerId) return;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    pointerIdRef.current = null;

    if (!recordingStartedRef.current && !movedRef.current) {
      persistMode(activeMode === "voice" ? "circle" : "voice");
      return;
    }

    const g = gestureRef.current;
    if (g === "cancel") {
      cancelRecording();
      return;
    }
    if (g === "lock") {
      setLocked(true);
      setGesture("none");
      return;
    }
    if (recording && !locked) {
      await finishSend();
    }
  }

  function handlePointerCancel() {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
    if (!locked && recordingStartedRef.current) cancelRecording();
    pointerIdRef.current = null;
    if (!locked) setGesture("none");
  }

  const overlayStyle = anchor
    ? ({ "--rec-x": `${anchor.x}px`, "--rec-y": `${anchor.y}px` } as React.CSSProperties)
    : undefined;

  return (
    <>
      {active && (
        <div
          className={`record-overlay record-overlay-${activeMode}`}
          style={overlayStyle}
          aria-live="polite"
        >
          {activeMode === "circle" && (
            <div className={`record-circle-preview ${gesture === "cancel" ? "record-circle-cancel" : ""}`}>
              <video ref={previewRef} className="record-circle-video" muted playsInline />
              <div className="record-circle-ring" />
              <span className="record-circle-timer">{duration}s / {maxDuration}s</span>
            </div>
          )}
          <div
            className={`record-hint-panel ${gesture === "cancel" ? "record-hint-cancel" : ""} ${gesture === "lock" ? "record-hint-lock" : ""}`}
          >
            <span className={`record-hint record-hint-left ${gesture === "cancel" ? "active" : ""}`}>Отмена</span>
            <span className="record-hint-timer">{duration}s</span>
            <span className={`record-hint record-hint-right ${gesture === "lock" ? "active" : ""}`}>
              {locked ? "Заблокировано" : "Вверх — без удержания"}
            </span>
          </div>
        </div>
      )}
      {locked ? (
        <button
          type="button"
          className="compose-btn compose-btn-icon compose-btn-record-stop"
          onClick={() => void finishSend()}
          disabled={disabled}
        >
          {duration}s
        </button>
      ) : (
        <button
          ref={btnRef}
          type="button"
          className={`compose-btn compose-btn-icon compose-btn-record ${recording ? "compose-btn-recording" : ""}`}
          disabled={disabled}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          title={activeMode === "voice" ? "Клик — кружок, удержание — голос" : "Клик — голос, удержание — кружок"}
          data-testid="compose-record-btn"
          data-mode={activeMode}
        >
          {activeMode === "voice" ? <IconMic size={22} /> : <IconCircle size={22} />}
        </button>
      )}
    </>
  );
}
