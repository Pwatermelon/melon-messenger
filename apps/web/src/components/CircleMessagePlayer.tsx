import { useCallback, useEffect, useRef, useState } from "react";
import { IconPlay, IconPause } from "./Icons";

const OUTER = 220;
const VIDEO = 188;
const RING = 5;
const R = (OUTER - RING) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;
const INNER_HIT = VIDEO / 2 + 2;

type Props = {
  src: string;
  duration?: number;
};

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `0:${s.toString().padStart(2, "0")}`;
}

function angleFromPointer(clientX: number, clientY: number, rect: DOMRect): number {
  const x = clientX - rect.left - rect.width / 2;
  const y = clientY - rect.top - rect.height / 2;
  let angle = Math.atan2(y, x) + Math.PI / 2;
  if (angle < 0) angle += Math.PI * 2;
  return angle / (Math.PI * 2);
}

function onRing(clientX: number, clientY: number, rect: DOMRect): boolean {
  const x = clientX - rect.left - rect.width / 2;
  const y = clientY - rect.top - rect.height / 2;
  const dist = Math.hypot(x, y);
  return dist >= INNER_HIT && dist <= OUTER / 2;
}

export function CircleMessagePlayer({ src, duration: metaDuration }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const ringRef = useRef<SVGSVGElement>(null);
  const scrubbingRef = useRef(false);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(metaDuration ?? 0);
  const [error, setError] = useState(false);

  const seekTo = useCallback((pct: number) => {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.duration)) return;
    const t = Math.max(0, Math.min(1, pct)) * video.duration;
    video.currentTime = t;
    setProgress(t / video.duration);
    setCurrent(t);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => {
      if (video.duration && Number.isFinite(video.duration)) {
        setProgress(video.currentTime / video.duration);
        setCurrent(video.currentTime);
      }
    };
    const onMeta = () => {
      if (video.duration && Number.isFinite(video.duration)) {
        setDuration(Math.round(video.duration));
      }
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
      setCurrent(0);
      video.currentTime = 0;
    };

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("ended", onEnd);
    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("ended", onEnd);
    };
  }, [src]);

  useEffect(() => {
    setPlaying(false);
    setProgress(0);
    setCurrent(0);
    setError(false);
  }, [src]);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
      setPlaying(false);
    } else {
      setError(false);
      void video.play()
        .then(() => setPlaying(true))
        .catch(() => setError(true));
    }
  }

  function handleRingPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    const rect = ringRef.current?.getBoundingClientRect();
    if (!rect || !onRing(e.clientX, e.clientY, rect)) return;
    e.preventDefault();
    scrubbingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    seekTo(angleFromPointer(e.clientX, e.clientY, rect));
  }

  function handleRingPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!scrubbingRef.current) return;
    const rect = ringRef.current?.getBoundingClientRect();
    if (!rect) return;
    seekTo(angleFromPointer(e.clientX, e.clientY, rect));
  }

  function handleRingPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    if (!scrubbingRef.current) return;
    scrubbingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }

  const offset = CIRCUMFERENCE * (1 - progress);
  const cx = OUTER / 2;

  return (
    <div className="circle-player" style={{ width: OUTER, height: OUTER }}>
      <svg
        ref={ringRef}
        className="circle-player-ring"
        width={OUTER}
        height={OUTER}
        viewBox={`0 0 ${OUTER} ${OUTER}`}
        onPointerDown={handleRingPointerDown}
        onPointerMove={handleRingPointerMove}
        onPointerUp={handleRingPointerUp}
        onPointerCancel={handleRingPointerUp}
        aria-hidden
      >
        <circle
          cx={cx}
          cy={cx}
          r={R}
          className="circle-player-ring-bg"
          fill="none"
          strokeWidth={RING}
        />
        <circle
          cx={cx}
          cy={cx}
          r={R}
          className="circle-player-ring-progress"
          fill="none"
          strokeWidth={RING}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cx})`}
        />
      </svg>
      <button
        type="button"
        className="circle-player-video-btn"
        onClick={togglePlay}
        aria-label={playing ? "Пауза" : "Воспроизвести"}
      >
        <video ref={videoRef} className="circle-player-video" src={src} playsInline preload="metadata" />
        <span className={`circle-player-overlay${playing ? " is-playing" : ""}`}>
          {error ? (
            <span className="circle-player-error">!</span>
          ) : playing ? (
            <IconPause size={32} />
          ) : (
            <IconPlay size={36} />
          )}
        </span>
      </button>
      <span className="circle-player-time">
        {error ? "Ошибка" : `${formatTime(current)}${duration ? ` / ${formatTime(duration)}` : ""}`}
      </span>
    </div>
  );
}
