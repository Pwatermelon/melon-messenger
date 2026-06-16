import { useRef, useState } from "react";
import { useVoiceRecorder } from "../hooks/useVoiceRecorder";

type Gesture = "none" | "cancel" | "lock";

interface HoldVoiceRecorderProps {
  disabled?: boolean;
  onSend: (blob: Blob, duration: number) => void | Promise<void>;
}

export function HoldVoiceRecorder({ disabled, onSend }: HoldVoiceRecorderProps) {
  const { recording, duration, start, stop, cancel } = useVoiceRecorder();
  const [locked, setLocked] = useState(false);
  const [gesture, setGesture] = useState<Gesture>("none");
  const pointerIdRef = useRef<number | null>(null);
  const originRef = useRef({ x: 0, y: 0 });

  async function finishSend() {
    const { blob, duration: d } = await stop();
    setLocked(false);
    setGesture("none");
    if (blob.size >= 200) await onSend(blob, d);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (disabled || locked) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerIdRef.current = e.pointerId;
    originRef.current = { x: e.clientX, y: e.clientY };
    setGesture("none");
    void start();
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    if (!recording || locked || pointerIdRef.current !== e.pointerId) return;
    const dx = e.clientX - originRef.current.x;
    const dy = e.clientY - originRef.current.y;
    if (dx < -70) setGesture("cancel");
    else if (dy < -70) setGesture("lock");
    else setGesture("none");
  }

  async function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    if (pointerIdRef.current !== e.pointerId) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    pointerIdRef.current = null;

    if (gesture === "cancel") {
      cancel();
      setGesture("none");
      return;
    }
    if (gesture === "lock") {
      setLocked(true);
      setGesture("none");
      return;
    }
    if (recording && !locked) {
      await finishSend();
    }
  }

  function handlePointerCancel() {
    if (!locked) cancel();
    pointerIdRef.current = null;
    setGesture("none");
  }

  return (
    <>
      {(recording || locked) && (
        <div className="voice-hold-overlay" aria-live="polite">
          <div className={`voice-hold-panel ${gesture === "cancel" ? "voice-hold-cancel" : ""} ${gesture === "lock" ? "voice-hold-lock" : ""}`}>
            <span className={`voice-hold-hint voice-hold-hint-left ${gesture === "cancel" ? "active" : ""}`}>🗑 Отмена</span>
            <span className="voice-hold-timer">{duration}s</span>
            <span className={`voice-hold-hint voice-hold-hint-right ${gesture === "lock" ? "active" : ""}`}>
              {locked ? "🔒 Заблокировано" : "🔒 Вверх — блок"}
            </span>
          </div>
        </div>
      )}
      {locked ? (
        <button type="button" className="compose-btn compose-btn-icon voice-stop" onClick={() => void finishSend()} disabled={disabled}>
          {duration}s ✓
        </button>
      ) : (
        <button
          type="button"
          className={`compose-btn compose-btn-icon ${recording ? "voice-recording" : ""}`}
          disabled={disabled}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          title="Удерживайте для записи"
        >
          🎤
        </button>
      )}
    </>
  );
}
