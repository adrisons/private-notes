import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSwipeReveal } from "../use-swipe-reveal";

describe("useSwipeReveal", () => {
  it("opens when the swipe passes the threshold", () => {
    const onOpenChange = vi.fn();
    const { result, unmount } = renderHook(() =>
      useSwipeReveal({
        actionsWidth: 96,
        enabled: true,
        open: false,
        onOpenChange,
      }),
    );

    const host = document.createElement("button");
    document.body.appendChild(host);

    act(() => {
      result.current.bind.onTouchStart({
        changedTouches: [{ clientX: 200, clientY: 40 }],
      } as never);
    });

    act(() => {
      result.current.bind.onTouchMove({
        changedTouches: [{ clientX: 80, clientY: 40 }],
        preventDefault: vi.fn(),
        currentTarget: host,
      } as never);
    });

    act(() => {
      result.current.bind.onTouchEnd({} as never);
    });

    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(result.current.offset).toBe(-96);

    unmount();
    host.remove();
  });

  it("does not move when disabled", () => {
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useSwipeReveal({
        actionsWidth: 96,
        enabled: false,
        open: false,
        onOpenChange,
      }),
    );

    act(() => {
      result.current.bind.onTouchStart({
        changedTouches: [{ clientX: 200, clientY: 40 }],
      } as never);
      result.current.bind.onTouchMove({
        changedTouches: [{ clientX: 80, clientY: 40 }],
        preventDefault: vi.fn(),
      } as never);
      result.current.bind.onTouchEnd({} as never);
    });

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(result.current.offset).toBe(0);
  });
});
