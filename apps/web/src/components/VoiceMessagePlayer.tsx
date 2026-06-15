import { useEffect, useRef, useState } from "react";

import { IconPlay, IconPause } from "./Icons";

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceMessagePlayer({ src, duration: metaDuration }: { src: string; duration?: number }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(metaDuration ?? 0);
  const [error, setError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      if (audio.duration && Number.isFinite(audio.duration)) {
        setProgress(audio.currentTime / audio.duration);
      }
    };
    const onMeta = () => {
      if (audio.duration && Number.isFinite(audio.duration)) {
        setDuration(Math.round(audio.duration));
      }
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, [src]);

  useEffect(() => {
    setError(false);
    setPlaying(false);
    setProgress(0);
  }, [src]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      setError(false);
      void audio.play()
        .then(() => setPlaying(true))
        .catch(() => setError(true));
    }
  }

  const bars = Array.from({ length: 28 }, (_, i) => {
    const h = 4 + ((i * 7 + 3) % 11);
    return h;
  });

  return (
    <div className="voice-player">
      <audio ref={audioRef} src={src} preload="auto" />
      <button type="button" className="voice-player-btn" onClick={toggle} aria-label={playing ? "Пауза" : "Воспроизвести"}>
        {playing ? <IconPause size={18} /> : <IconPlay size={18} />}
      </button>
      <div className="voice-player-body">
        <div className={`voice-player-wave ${playing ? "voice-player-wave-active" : ""}`}>
          {bars.map((h, i) => (
            <span
              key={i}
              className="voice-player-bar"
              style={{ height: `${h}px`, opacity: progress > i / bars.length ? 1 : 0.35 }}
            />
          ))}
        </div>
        <div className="voice-player-track">
          <div className="voice-player-fill" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
      <span className="voice-player-time">{error ? "Ошибка" : formatTime(duration)}</span>
    </div>
  );
}
