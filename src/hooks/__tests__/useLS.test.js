// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useLS } from "../useLS.js";

describe("useLS", () => {
  beforeEach(() => localStorage.clear());

  it("retourne la valeur par défaut quand rien n'est stocké", () => {
    const { result } = renderHook(() => useLS("k", { a: 1 }));
    expect(result.current[0]).toEqual({ a: 1 });
  });

  it("lit la valeur déjà présente dans le localStorage", () => {
    localStorage.setItem("k", JSON.stringify([1, 2, 3]));
    const { result } = renderHook(() => useLS("k", []));
    expect(result.current[0]).toEqual([1, 2, 3]);
  });

  it("persiste les mises à jour dans le localStorage", () => {
    const { result } = renderHook(() => useLS("k", 0));
    act(() => result.current[1](5));
    expect(result.current[0]).toBe(5);
    expect(JSON.parse(localStorage.getItem("k"))).toBe(5);
  });

  it("supporte un updater fonctionnel", () => {
    const { result } = renderHook(() => useLS("n", 1));
    act(() => result.current[1](v => v + 1));
    expect(result.current[0]).toBe(2);
  });

  it("retombe sur la valeur par défaut si le JSON stocké est invalide", () => {
    localStorage.setItem("k", "{pas du json");
    const { result } = renderHook(() => useLS("k", "fallback"));
    expect(result.current[0]).toBe("fallback");
  });
});
