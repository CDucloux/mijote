// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useOnline } from "../useOnline.js";

describe("useOnline", () => {
  it("est en ligne par défaut (navigator.onLine)", () => {
    const { result } = renderHook(() => useOnline());
    expect(result.current).toBe(true);
  });

  it("réagit aux événements offline / online de la fenêtre", () => {
    const { result } = renderHook(() => useOnline());
    act(() => window.dispatchEvent(new Event("offline")));
    expect(result.current).toBe(false);
    act(() => window.dispatchEvent(new Event("online")));
    expect(result.current).toBe(true);
  });

  it("retire ses écouteurs au démontage", () => {
    const { unmount, result } = renderHook(() => useOnline());
    unmount();
    // Après démontage, un événement ne doit plus lever d'erreur ni modifier l'état.
    act(() => window.dispatchEvent(new Event("offline")));
    expect(result.current).toBe(true);
  });
});
