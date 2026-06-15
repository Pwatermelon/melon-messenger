import { useEffect, useRef } from "react";
import { IconForward } from "./Icons";

type Props = {
  x: number;
  y: number;
  onForward: () => void;
  onClose: () => void;
};

export function MessageContextMenu({ x, y, onForward, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let left = x;
    let top = y;
    if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad;
    if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [x, y]);

  return (
    <>
      <div className="message-menu-backdrop" onClick={onClose} />
      <div ref={ref} className="message-context-menu" style={{ left: x, top: y }} role="menu">
        <button type="button" className="message-context-menu-item" onClick={onForward} role="menuitem">
          <IconForward size={18} /> Переслать
        </button>
      </div>
    </>
  );
}
