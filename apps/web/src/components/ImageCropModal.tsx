import { useEffect, useRef, useState, useCallback } from "react";
import { cropImageFile, type CropArea } from "../utils/imageCrop";

type Variant = "avatar" | "cover";

type Props = {
  file: File;
  variant: Variant;
  title: string;
  onConfirm: (cropped: File, original?: File) => void;
  onCancel: () => void;
};

type Layout = {
  scale: number;
  offsetX: number;
  offsetY: number;
  displayW: number;
  displayH: number;
};

type CropRect = { x: number; y: number; w: number; h: number };

const AVATAR_VIEW = 300;
const COVER_VIEW_W = 320;
const COVER_ASPECT = 4.5;

function viewSize(variant: Variant): { w: number; h: number; aspect: number } {
  if (variant === "avatar") return { w: AVATAR_VIEW, h: AVATAR_VIEW, aspect: 1 };
  return { w: COVER_VIEW_W, h: Math.round(COVER_VIEW_W / COVER_ASPECT), aspect: COVER_ASPECT };
}

function computeLayout(nw: number, nh: number, viewW: number, viewH: number): Layout {
  const scale = Math.min(viewW / nw, viewH / nh);
  const displayW = nw * scale;
  const displayH = nh * scale;
  return {
    scale,
    offsetX: (viewW - displayW) / 2,
    offsetY: (viewH - displayH) / 2,
    displayW,
    displayH,
  };
}

function clampCrop(rect: CropRect, layout: Layout, aspect: number): CropRect {
  let { x, y, w } = rect;
  const minW = variantMinSize(aspect);
  const maxW = Math.min(layout.displayW, layout.displayH * aspect);
  w = Math.max(minW, Math.min(maxW, w));
  const clampedH = w / aspect;
  x = Math.max(layout.offsetX, Math.min(layout.offsetX + layout.displayW - w, x));
  y = Math.max(layout.offsetY, Math.min(layout.offsetY + layout.displayH - clampedH, y));
  return { x, y, w, h: clampedH };
}

function variantMinSize(aspect: number): number {
  return aspect === 1 ? 64 : 80;
}

function initialCrop(layout: Layout, aspect: number): CropRect {
  const maxW = Math.min(layout.displayW, layout.displayH * aspect) * 0.75;
  const w = Math.max(variantMinSize(aspect), maxW);
  const h = w / aspect;
  return clampCrop(
    {
      x: layout.offsetX + (layout.displayW - w) / 2,
      y: layout.offsetY + (layout.displayH - h) / 2,
      w,
      h,
    },
    layout,
    aspect
  );
}

function cropToNatural(rect: CropRect, layout: Layout): CropArea {
  return {
    x: (rect.x - layout.offsetX) / layout.scale,
    y: (rect.y - layout.offsetY) / layout.scale,
    width: rect.w / layout.scale,
    height: rect.h / layout.scale,
  };
}

export default function ImageCropModal({ file, variant, title, onConfirm, onCancel }: Props) {
  const { w: viewW, h: viewH, aspect } = viewSize(variant);
  const outputW = variant === "avatar" ? 512 : 1200;
  const outputH = variant === "avatar" ? 512 : Math.round(1200 / COVER_ASPECT);

  const [previewUrl, setPreviewUrl] = useState("");
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [layout, setLayout] = useState<Layout | null>(null);
  const [crop, setCrop] = useState<CropRect | null>(null);
  const [busy, setBusy] = useState(false);

  const dragRef = useRef<{
    mode: "move" | "resize";
    startX: number;
    startY: number;
    startCrop: CropRect;
  } | null>(null);

  const dragHandlersRef = useRef({
    onMove: (_e: PointerEvent) => {},
    onUp: (_e: PointerEvent) => {},
  });

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!previewUrl) return;
    const img = new Image();
    img.onload = () => {
      const nw = img.naturalWidth;
      const nh = img.naturalHeight;
      const l = computeLayout(nw, nh, viewW, viewH);
      setNatural({ w: nw, h: nh });
      setLayout(l);
      setCrop(initialCrop(l, aspect));
    };
    img.src = previewUrl;
  }, [previewUrl, viewW, viewH, aspect]);

  const endDrag = useCallback(() => {
    dragRef.current = null;
    document.removeEventListener("pointermove", dragHandlersRef.current.onMove);
    document.removeEventListener("pointerup", dragHandlersRef.current.onUp);
    document.removeEventListener("pointercancel", dragHandlersRef.current.onUp);
  }, []);

  useEffect(() => {
    dragHandlersRef.current.onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !layout) return;
      e.preventDefault();
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      if (drag.mode === "move") {
        setCrop(clampCrop(
          {
            ...drag.startCrop,
            x: drag.startCrop.x + dx,
            y: drag.startCrop.y + dy,
          },
          layout,
          aspect
        ));
      } else {
        const newW = drag.startCrop.w + dx;
        setCrop(clampCrop(
          {
            x: drag.startCrop.x,
            y: drag.startCrop.y,
            w: newW,
            h: newW / aspect,
          },
          layout,
          aspect
        ));
      }
    };
    dragHandlersRef.current.onUp = () => endDrag();
  }, [layout, aspect, endDrag]);

  useEffect(() => () => endDrag(), [endDrag]);

  function startDrag(e: React.PointerEvent, mode: "move" | "resize") {
    if (!crop || !layout) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: { ...crop },
    };
    document.addEventListener("pointermove", dragHandlersRef.current.onMove, { passive: false });
    document.addEventListener("pointerup", dragHandlersRef.current.onUp, { passive: false });
    document.addEventListener("pointercancel", dragHandlersRef.current.onUp, { passive: false });
  }

  async function handleConfirm() {
    if (!layout || !crop || !natural.w) return;
    setBusy(true);
    try {
      const area = cropToNatural(crop, layout);
      const cropped = await cropImageFile(file, area, outputW, outputH);
      onConfirm(cropped, variant === "avatar" ? file : undefined);
    } finally {
      setBusy(false);
    }
  }

  const circle = variant === "avatar";

  return (
    <div className="search-overlay image-crop-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="search-modal image-crop-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="modal-close" onClick={onCancel} aria-label="Закрыть">
          ×
        </button>
        <h3>{title}</h3>
        <p className="image-crop-hint">
          {circle ? "Переместите круг и потяните за угол" : "Переместите рамку и потяните за угол"}
        </p>
        <div className="image-crop-viewport" style={{ width: viewW, height: viewH }}>
          {previewUrl && layout && (
            <img
              src={previewUrl}
              alt=""
              className="image-crop-image"
              style={{
                width: layout.displayW,
                height: layout.displayH,
                left: layout.offsetX,
                top: layout.offsetY,
              }}
              draggable={false}
            />
          )}
          {crop && (
            <div
              className={`image-crop-selection${circle ? " image-crop-selection-circle" : ""}`}
              style={{ left: crop.x, top: crop.y, width: crop.w, height: crop.h }}
              onPointerDown={(e) => startDrag(e, "move")}
            >
              <div
                className="image-crop-handle"
                onPointerDown={(e) => startDrag(e, "resize")}
                aria-hidden
              />
            </div>
          )}
        </div>
        <div className="image-crop-actions">
          <button type="button" className="btn" onClick={() => void handleConfirm()} disabled={busy || !crop}>
            {busy ? "…" : "Применить"}
          </button>
        </div>
      </div>
    </div>
  );
}
