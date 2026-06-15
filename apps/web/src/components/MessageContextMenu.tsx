import { useEffect, useRef } from "react";
import { IconEdit, IconForward, IconReply } from "./Icons";

type Props = {
  x: number;
  y: number;
  onReply: () => void;
  onForward: () => void;
  onEdit?: () => void;
  onClose: () => void;
};

export function MessageContextMenu({ x, y, onReply, onForward, onEdit, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const menu = ref.current;
      if (!menu || menu.contains(e.target as Node)) return;
      onClose();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => window.removeEventListener("pointerdown", onPointerDown, true);
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
    <div
      ref={ref}
      className="message-context-menu"
      style={{ left: x, top: y }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      <button type="button" className="message-context-menu-item" onClick={onReply} role="menuitem">
        <IconReply size={18} /> Ответить
      </button>
      {onEdit && (
        <button type="button" className="message-context-menu-item" onClick={onEdit} role="menuitem">
          <IconEdit size={18} /> Изменить
        </button>
      )}
      <button type="button" className="message-context-menu-item" onClick={onForward} role="menuitem">
        <IconForward size={18} /> Переслать
      </button>
    </div>
  );
}
