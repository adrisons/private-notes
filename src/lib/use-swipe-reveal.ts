import { useCallback, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";

const OPEN_RATIO = 0.4;
const AXIS_LOCK_PX = 8;

export interface UseSwipeRevealOptions {
  actionsWidth: number;
  enabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface SwipeRevealBind {
  onTouchStart: (event: ReactTouchEvent<HTMLElement>) => void;
  onTouchMove: (event: ReactTouchEvent<HTMLElement>) => void;
  onTouchEnd: (event: ReactTouchEvent<HTMLElement>) => void;
  onTouchCancel: (event: ReactTouchEvent<HTMLElement>) => void;
}

export interface UseSwipeRevealResult {
  offset: number;
  isDragging: boolean;
  close: () => void;
  bind: SwipeRevealBind;
}

export function useSwipeReveal({
  actionsWidth,
  enabled,
  open,
  onOpenChange,
}: UseSwipeRevealOptions): UseSwipeRevealResult {
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startOffsetRef = useRef(0);
  const offsetRef = useRef(0);
  const draggingRef = useRef(false);
  const axisRef = useRef<"pending" | "horizontal" | "vertical">("pending");

  const clampOffset = useCallback(
    (value: number) => Math.max(-actionsWidth, Math.min(0, value)),
    [actionsWidth],
  );

  const applyOffset = useCallback(
    (value: number) => {
      const next = clampOffset(value);
      offsetRef.current = next;
      setOffset(next);
    },
    [clampOffset],
  );

  const close = useCallback(() => {
    onOpenChange(false);
    applyOffset(0);
  }, [applyOffset, onOpenChange]);

  const settle = useCallback(
    (value: number) => {
      const shouldOpen = value <= -actionsWidth * OPEN_RATIO;
      onOpenChange(shouldOpen);
      applyOffset(shouldOpen ? -actionsWidth : 0);
    },
    [actionsWidth, applyOffset, onOpenChange],
  );

  const resetGesture = useCallback(() => {
    draggingRef.current = false;
    setIsDragging(false);
    axisRef.current = "pending";
  }, []);

  useEffect(() => {
    if (!enabled || draggingRef.current) return;
    applyOffset(open ? -actionsWidth : 0);
  }, [actionsWidth, applyOffset, enabled, open]);

  const onTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLElement>) => {
      if (!enabled) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      startOffsetRef.current = open ? -actionsWidth : 0;
      axisRef.current = "pending";
      draggingRef.current = true;
      setIsDragging(true);
      applyOffset(startOffsetRef.current);
    },
    [actionsWidth, applyOffset, enabled, open],
  );

  const onTouchMove = useCallback(
    (event: ReactTouchEvent<HTMLElement>) => {
      if (!enabled || !draggingRef.current) return;
      const touch = event.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - startXRef.current;
      const deltaY = touch.clientY - startYRef.current;

      if (axisRef.current === "pending") {
        if (Math.abs(deltaX) < AXIS_LOCK_PX && Math.abs(deltaY) < AXIS_LOCK_PX) return;
        axisRef.current =
          Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
      }

      if (axisRef.current !== "horizontal") return;

      event.preventDefault();
      applyOffset(startOffsetRef.current + deltaX);
    },
    [applyOffset, enabled],
  );

  const onTouchEnd = useCallback(() => {
    if (!enabled || !draggingRef.current) return;
    settle(offsetRef.current);
    resetGesture();
  }, [enabled, resetGesture, settle]);

  const onTouchCancel = useCallback(() => {
    if (!enabled || !draggingRef.current) return;
    settle(open ? -actionsWidth : 0);
    resetGesture();
  }, [actionsWidth, enabled, open, resetGesture, settle]);

  const resolvedOffset = enabled ? (open && !isDragging ? -actionsWidth : offset) : 0;

  return {
    offset: resolvedOffset,
    isDragging,
    close,
    bind: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onTouchCancel,
    },
  };
}
