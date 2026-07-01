import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { IconExpand, IconPause, IconPlay } from "./Icons";
import { canPlayMediaUrl, mimeFromMediaUrl } from "../utils/mediaMime";
import { claimMediaPlayback, releaseMediaPlayback } from "../utils/mediaPlayback";
import { displayMessageMediaSize } from "../utils/messageMediaSize";
import {
  getVideoMetaCache,
  getVideoPosterCache,
  probeVideoMeta,
  setVideoMetaCache,
  setVideoPosterCache,
} from "../utils/videoMetaCache";
import { captureVideoFramePoster } from "../utils/videoPoster";
import { attachVideoPreviewHandlers } from "../utils/videoPreview";

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function resolveDims(
  width?: number,
  height?: number,
  src?: string
): { w: number; h: number } | null {
  if (width && height) return { w: width, h: height };
  if (src) {
    const cached = getVideoMetaCache(src);
    if (cached) return { w: cached.width, h: cached.height };
  }
  return null;
}

type Props = {
  src: string;
  poster?: string | null;
  width?: number;
  height?: number;
  duration?: number;
  onExpand?: () => void;
};

export function MessageVideoPlayer({ src, poster, width, height, duration: metaDuration, onExpand }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(false);
  const wasPlayingRef = useRef(false);
  const stopRef = useRef<() => void>(() => {});

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(metaDuration ?? 0);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(() => resolveDims(width, height, src));
  const [posterSrc, setPosterSrc] = useState<string | null>(() => poster ?? getVideoPosterCache(src));
  const [showFrame, setShowFrame] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  const mime = mimeFromMediaUrl(src, "video");

  const stopPlayback = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      video.pause();
    }
    setPlaying(false);
  }, []);

  stopRef.current = () => {
    const video = videoRef.current;
    if (video) {
      video.pause();
    }
    setPlaying(false);
  };

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      const video = videoRef.current;
      if (!track || !video) return;
      const dur = video.duration;
      if (!dur || !Number.isFinite(dur)) return;
      const rect = track.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const t = pct * dur;
      video.currentTime = t;
      setProgress(pct);
      setCurrent(t);
      setShowFrame(true);
    },
    []
  );

  const scrubHandlersRef = useRef({
    onMove: (e: PointerEvent) => {
      if (!scrubbingRef.current) return;
      e.preventDefault();
      seekFromClientX(e.clientX);
    },
    onUp: (e: PointerEvent) => {
      if (!scrubbingRef.current) return;
      e.preventDefault();
      seekFromClientX(e.clientX);
      scrubbingRef.current = false;
      const video = videoRef.current;
      if (video && wasPlayingRef.current) {
        void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      }
      document.removeEventListener("pointermove", scrubHandlersRef.current.onMove);
      document.removeEventListener("pointerup", scrubHandlersRef.current.onUp);
      document.removeEventListener("pointercancel", scrubHandlersRef.current.onUp);
    },
  });

  useEffect(() => {
    scrubHandlersRef.current.onMove = (e: PointerEvent) => {
      if (!scrubbingRef.current) return;
      e.preventDefault();
      seekFromClientX(e.clientX);
    };
    scrubHandlersRef.current.onUp = (e: PointerEvent) => {
      if (!scrubbingRef.current) return;
      e.preventDefault();
      seekFromClientX(e.clientX);
      scrubbingRef.current = false;
      const video = videoRef.current;
      if (video && wasPlayingRef.current) {
        void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      }
      document.removeEventListener("pointermove", scrubHandlersRef.current.onMove);
      document.removeEventListener("pointerup", scrubHandlersRef.current.onUp);
      document.removeEventListener("pointercancel", scrubHandlersRef.current.onUp);
    };
  }, [seekFromClientX]);

  useEffect(() => {
    return () => {
      scrubbingRef.current = false;
      document.removeEventListener("pointermove", scrubHandlersRef.current.onMove);
      document.removeEventListener("pointerup", scrubHandlersRef.current.onUp);
      document.removeEventListener("pointercancel", scrubHandlersRef.current.onUp);
    };
  }, []);

  useEffect(() => {
    setUnsupported(!canPlayMediaUrl(src, "video"));
    setPlaying(false);
    setProgress(0);
    setCurrent(0);
    setDuration(metaDuration ?? 0);
    setShowFrame(false);
    const nextDims = resolveDims(width, height, src);
    setDims(nextDims);
    setPosterSrc(poster ?? getVideoPosterCache(src));
    return () => releaseMediaPlayback(stopRef.current);
  }, [src, poster, width, height, metaDuration]);

  useEffect(() => {
    if (dims) return;
    let cancelled = false;
    void probeVideoMeta(src).then((meta) => {
      if (cancelled || !meta) return;
      setDims({ w: meta.width, h: meta.height });
      if (meta.duration) setDuration(meta.duration);
    });
    return () => {
      cancelled = true;
    };
  }, [src, dims]);

  useEffect(() => {
    if (posterSrc) return;
    let cancelled = false;
    void captureVideoFramePoster(src).then((blobUrl) => {
      if (cancelled || !blobUrl) return;
      setVideoPosterCache(src, blobUrl);
      setPosterSrc(blobUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [src, posterSrc]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    return attachVideoPreviewHandlers(video, () => setShowFrame(true));
  }, [src]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (scrubbingRef.current) return;
      const dur = video.duration;
      if (dur && Number.isFinite(dur)) {
        setProgress(video.currentTime / dur);
        setCurrent(video.currentTime);
        setDuration(dur);
      }
    };
    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      setCurrent(0);
      setShowFrame(false);
      releaseMediaPlayback(stopRef.current);
    };
    const onMeta = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        const meta = {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration && Number.isFinite(video.duration) ? video.duration : undefined,
        };
        setVideoMetaCache(src, meta);
        setDims((prev) => prev ?? { w: meta.width, h: meta.height });
      }
      if (video.duration && Number.isFinite(video.duration)) {
        setDuration(video.duration);
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    video.addEventListener("loadedmetadata", onMeta);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
      video.removeEventListener("loadedmetadata", onMeta);
    };
  }, [src]);

  let boxStyle: CSSProperties;
  if (dims) {
    const size = displayMessageMediaSize(dims.w, dims.h);
    boxStyle = { width: size.width, height: size.height };
  } else {
    const size = displayMessageMediaSize(9, 16);
    boxStyle = { width: size.width, height: size.height };
  }

  const showPoster = !playing && !showFrame && Boolean(posterSrc);

  function togglePlay(e: React.MouseEvent) {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video || unsupported) return;
    if (playing) {
      video.pause();
      setPlaying(false);
      releaseMediaPlayback(stopRef.current);
      return;
    }
    setShowFrame(true);
    claimMediaPlayback(stopRef.current);
    void video
      .play()
      .then(() => setPlaying(true))
      .catch(() => {
        setPlaying(false);
        releaseMediaPlayback(stopRef.current);
      });
  }

  function handleScrubDown(e: React.PointerEvent<HTMLDivElement>) {
    if (unsupported) return;
    e.preventDefault();
    e.stopPropagation();
    const video = videoRef.current;
    wasPlayingRef.current = !!video && !video.paused;
    if (video && wasPlayingRef.current) video.pause();

    scrubbingRef.current = true;
    seekFromClientX(e.clientX);
    trackRef.current?.setPointerCapture(e.pointerId);
    document.addEventListener("pointermove", scrubHandlersRef.current.onMove, { passive: false });
    document.addEventListener("pointerup", scrubHandlersRef.current.onUp, { passive: false });
    document.addEventListener("pointercancel", scrubHandlersRef.current.onUp, { passive: false });
  }

  function handleExpand(e: React.MouseEvent) {
    e.stopPropagation();
    stopPlayback();
    releaseMediaPlayback(stopRef.current);
    onExpand?.();
  }

  return (
    <div className="message-video-player" style={boxStyle}>
      <div className="message-video-stage">
        {showPoster && (
          <img src={posterSrc!} alt="" className="message-video-poster" draggable={false} />
        )}
        {!posterSrc && !showFrame && !playing && (
          <span className="message-video-skeleton" aria-hidden />
        )}
        <video
          ref={videoRef}
          className={`message-video-el${showPoster ? " is-hidden" : ""}`}
          src={src}
          playsInline
          preload="auto"
          muted={false}
          controls={false}
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
          onContextMenu={(e) => e.preventDefault()}
        >
          <source src={src} type={mime} />
        </video>
        {!playing && (
          <button
            type="button"
            className="message-video-center-play"
            onClick={togglePlay}
            disabled={unsupported}
            aria-label="Воспроизвести"
          >
            {unsupported ? "!" : <IconPlay size={30} />}
          </button>
        )}
      </div>
      <div className="message-video-bar" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="message-video-bar-btn"
          onClick={togglePlay}
          disabled={unsupported}
          aria-label={playing ? "Пауза" : "Воспроизвести"}
        >
          {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
        </button>
        <div
          className="message-video-scrub"
          ref={trackRef}
          onPointerDown={handleScrubDown}
          role="slider"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(current)}
          aria-label="Позиция воспроизведения"
        >
          <div className="message-video-scrub-track">
            <div className="message-video-scrub-fill" style={{ width: `${progress * 100}%` }} />
          </div>
        </div>
        <span className="message-video-bar-time">
          {formatTime(current)} / {formatTime(duration)}
        </span>
        {onExpand && (
          <button type="button" className="message-video-bar-btn" onClick={handleExpand} aria-label="На весь экран">
            <IconExpand size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
