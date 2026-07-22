import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useInstallPrompt } from "../useInstallPrompt";

/** Builds a `beforeinstallprompt`-shaped event with a recorded user choice. */
function makeInstallEvent(outcome: "accepted" | "dismissed"): Event {
  const event = new Event("beforeinstallprompt");
  Object.assign(event, {
    prompt: () => Promise.resolve(),
    userChoice: Promise.resolve({ outcome }),
  });
  return event;
}

describe("useInstallPrompt", () => {
  it("starts with no install offer", () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
    expect(result.current.installed).toBe(false);
  });

  it("exposes the prompt after beforeinstallprompt fires", () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      window.dispatchEvent(makeInstallEvent("accepted"));
    });
    expect(result.current.canInstall).toBe(true);
  });

  it("resolves the user choice and clears the offer", async () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      window.dispatchEvent(makeInstallEvent("accepted"));
    });

    let accepted: boolean | undefined;
    await act(async () => {
      accepted = await result.current.promptInstall();
    });

    expect(accepted).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });

  it("marks the app installed on appinstalled", () => {
    const { result } = renderHook(() => useInstallPrompt());
    act(() => {
      window.dispatchEvent(makeInstallEvent("dismissed"));
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(result.current.installed).toBe(true);
    expect(result.current.canInstall).toBe(false);
  });
});
