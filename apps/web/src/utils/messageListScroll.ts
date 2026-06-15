export type ScrollAnchor = {
  messageId: string;
  top: number;
};

export function captureScrollAnchor(listEl: HTMLElement, messageId: string): ScrollAnchor | null {
  const anchor = listEl.querySelector(`[data-message-id="${messageId}"]`);
  if (!anchor) return null;
  return { messageId, top: anchor.getBoundingClientRect().top };
}

export function restoreScrollAnchor(listEl: HTMLElement, anchor: ScrollAnchor): void {
  const el = listEl.querySelector(`[data-message-id="${anchor.messageId}"]`);
  if (!el) return;
  const delta = el.getBoundingClientRect().top - anchor.top;
  if (Math.abs(delta) > 0.5) listEl.scrollTop += delta;
}
