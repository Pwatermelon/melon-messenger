import { useEffect, useState } from "react";
import { MessageVideoPlayer } from "./MessageVideoPlayer";
import { LightboxDownloadButton } from "./LightboxDownloadButton";
import { mediaDownloadUrl } from "../utils/mediaUrl";

export type MediaLightboxItem = {
  url: string;
  kind: "image" | "video";
  duration?: number;
  poster?: string | null;
  width?: number;
  height?: number;
  downloadPath?: string | null;
  fileName?: string | null;
};

type Props = {
  items: MediaLightboxItem[];
  initialIndex?: number;
  onClose: () => void;
  nested?: boolean;
  title?: string;
};

function itemDownloadHref(item: MediaLightboxItem): string {
  if (item.downloadPath) return mediaDownloadUrl(item.downloadPath, item.fileName);
  return mediaDownloadUrl(item.url, item.fileName);
}

export default function MediaLightbox({
  items,
  initialIndex = 0,
  onClose,
  nested = false,
  title,
}: Props) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, items]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(items.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items.length, onClose]);

  if (items.length === 0) return null;

  const current = items[index] ?? items[0];
  const canPrev = index > 0;
  const canNext = index < items.length - 1;
  const downloadHref = itemDownloadHref(current);

  return (
    <div
      className={`lightbox lightbox-gallery${nested ? " lightbox-nested" : ""}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Просмотр медиа"}
    >
      <LightboxDownloadButton href={downloadHref} fileName={current.fileName} />
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Закрыть">
        ×
      </button>
      {items.length > 1 && (
        <>
          <button
            type="button"
            className="lightbox-nav lightbox-nav-prev"
            onClick={(e) => {
              e.stopPropagation();
              if (canPrev) setIndex((i) => i - 1);
            }}
            disabled={!canPrev}
            aria-label="Предыдущее"
          >
            ‹
          </button>
          <button
            type="button"
            className="lightbox-nav lightbox-nav-next"
            onClick={(e) => {
              e.stopPropagation();
              if (canNext) setIndex((i) => i + 1);
            }}
            disabled={!canNext}
            aria-label="Следующее"
          >
            ›
          </button>
          <div className="lightbox-counter" aria-live="polite">
            {index + 1} / {items.length}
          </div>
        </>
      )}
      <div className="lightbox-gallery-body">
        <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
          {current.kind === "video" ? (
            <MessageVideoPlayer
              key={current.url}
              src={current.url}
              poster={current.poster}
              width={current.width}
              height={current.height}
              duration={current.duration}
              variant="lightbox"
              autoPlay
            />
          ) : (
            <img src={current.url} alt="" className="lightbox-img" />
          )}
        </div>
        {items.length > 1 && (
          <div className="lightbox-thumbs" role="listbox" aria-label="Миниатюры" onClick={(e) => e.stopPropagation()}>
            {items.map((item, i) => (
              <button
                key={`${item.url}-${i}`}
                type="button"
                className={`lightbox-thumb${i === index ? " lightbox-thumb-active" : ""}`}
                onClick={() => setIndex(i)}
                aria-label={`Медиа ${i + 1}`}
                aria-selected={i === index}
              >
                {item.kind === "video" ? (
                  <span className="lightbox-thumb-video">▶</span>
                ) : (
                  <img src={item.url} alt="" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
