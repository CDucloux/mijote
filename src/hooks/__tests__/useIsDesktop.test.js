// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useIsDesktop } from "../useIsDesktop.js";

function setWidth(w) {
  Object.defineProperty(window, "innerWidth", { value: w, writable: true, configurable: true });
}

describe("useIsDesktop", () => {
  afterEach(() => setWidth(1024));

  it("est desktop au-dessus de 768px", () => {
    setWidth(1024);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);
  });

  it("bascule en mobile sous 768px au redimensionnement", () => {
    setWidth(1024);
    const { result } = renderHook(() => useIsDesktop());
    act(() => { setWidth(500); window.dispatchEvent(new Event("resize")); });
    expect(result.current).toBe(false);
    act(() => { setWidth(900); window.dispatchEvent(new Event("resize")); });
    expect(result.current).toBe(true);
  });

  it("traite 768px comme desktop (borne incluse)", () => {
    setWidth(768);
    const { result } = renderHook(() => useIsDesktop());
    expect(result.current).toBe(true);
  });
});
