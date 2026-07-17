import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedCallback } from "../useDebouncedCallback";

describe("useDebouncedCallback", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fires once with the latest args after the delay", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 200));
    act(() => {
      result.current("a");
      result.current("b");
      result.current("c");
    });
    expect(fn).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("c");
  });

  it("flush() runs the pending call immediately with the latest args", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 200));
    act(() => {
      result.current("a");
      result.current("b");
      result.current.flush();
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("b");
    // The scheduled timer must not fire a second time after a flush.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("flush() is a no-op when nothing is pending", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 200));
    act(() => {
      result.current.flush();
    });
    expect(fn).not.toHaveBeenCalled();
  });

  it("cancel() drops the pending call without running it", () => {
    const fn = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(fn, 200));
    act(() => {
      result.current("a");
      result.current.cancel();
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(fn).not.toHaveBeenCalled();
    // A cancelled callback stays usable afterwards.
    act(() => {
      result.current("b");
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("b");
  });
});
