export type PrependScrollState = {
  scrollHeight: number;
  scrollTop: number;
};

export function capturePrependScroll(listEl: HTMLElement): PrependScrollState {
  return { scrollHeight: listEl.scrollHeight, scrollTop: listEl.scrollTop };
}

export function restorePrependScroll(listEl: HTMLElement, state: PrependScrollState): void {
  const delta = listEl.scrollHeight - state.scrollHeight;
  listEl.scrollTop = state.scrollTop + delta;
}
