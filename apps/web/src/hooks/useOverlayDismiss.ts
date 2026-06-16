import { useCallback, useRef } from "react";

/** Close overlay only when press+release both happen on the backdrop (not after text selection drag-out). */
export function useOverlayDismiss(onClose: () => void) {
  const fromOverlayRef = useRef(false);

  const onOverlayPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target === e.currentTarget) fromOverlayRef.current = true;
  }, []);

  const onOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && fromOverlayRef.current) onClose();
      fromOverlayRef.current = false;
    },
    [onClose]
  );

  const onModalPointerDown = useCallback(() => {
    fromOverlayRef.current = false;
  }, []);

  return { onOverlayPointerDown, onOverlayClick, onModalPointerDown };
}
