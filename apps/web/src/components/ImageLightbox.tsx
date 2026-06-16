import { useEffect, useState } from "react";

type Props = {
  images: string[];
  initialIndex?: number;
  onClose: () => void;
  canDelete?: boolean;
  onDelete?: (index: number) => void;
  title?: string;
};

export default function ImageLightbox({
  images,
  initialIndex = 0,
  onClose,
  canDelete,
  onDelete,
  title,
}: Props) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, images]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(images.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [images.length, onClose]);

  if (images.length === 0) return null;

  const current = images[index] ?? images[0];
  const canPrev = index > 0;
  const canNext = index < images.length - 1;

  return (
    <div
      className="lightbox lightbox-gallery"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title ?? "Просмотр фото"}
    >
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Закрыть">
        ×
      </button>
      {images.length > 1 && (
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
            {index + 1} / {images.length}
          </div>
        </>
      )}
      <div className="lightbox-gallery-body" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-content">
          <img src={current} alt="" className="lightbox-img" />
        </div>
        {images.length > 1 && (
          <div className="lightbox-thumbs" role="listbox" aria-label="Миниатюры">
            {images.map((src, i) => (
              <button
                key={`${src}-${i}`}
                type="button"
                className={`lightbox-thumb${i === index ? " lightbox-thumb-active" : ""}`}
                onClick={() => setIndex(i)}
                aria-label={`Фото ${i + 1}`}
                aria-selected={i === index}
              >
                <img src={src} alt="" />
              </button>
            ))}
          </div>
        )}
        {canDelete && onDelete && (
          <button
            type="button"
            className="lightbox-delete-btn"
            onClick={() => onDelete(index)}
          >
            Удалить это фото
          </button>
        )}
      </div>
    </div>
  );
}
