// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/lib/firebase/firestore.js", () => ({ fetchPublicRecipes: vi.fn() }));
import { fetchPublicRecipes } from "@/lib/firebase/firestore.js";
import { useDiscoverRecipes } from "../useDiscoverRecipes.js";

describe("useDiscoverRecipes", () => {
  beforeEach(() => fetchPublicRecipes.mockReset());

  it("charge le feed public au montage", async () => {
    fetchPublicRecipes.mockResolvedValue([{ pubId: "p1" }]);
    const user = { uid: "u_load" }; // référence stable (comme l'objet auth réel)
    const { result } = renderHook(() => useDiscoverRecipes(user));
    await waitFor(() => expect(result.current.loadedOnce).toBe(true));
    expect(result.current.recipes).toEqual([{ pubId: "p1" }]);
    expect(fetchPublicRecipes).toHaveBeenCalledTimes(1);
  });

  it("réhydrate depuis le cache au remontage sans re-fetcher (fix de l'écran blanc)", async () => {
    fetchPublicRecipes.mockResolvedValue([{ pubId: "cache" }]);
    const user = { uid: "u_cache" };
    const first = renderHook(() => useDiscoverRecipes(user));
    await waitFor(() => expect(first.result.current.loadedOnce).toBe(true));
    first.unmount();

    // Remontage même utilisateur : feed servi immédiatement, aucun nouvel appel.
    const { result } = renderHook(() => useDiscoverRecipes(user));
    expect(result.current.recipes).toEqual([{ pubId: "cache" }]);
    expect(result.current.loadedOnce).toBe(true);
    expect(fetchPublicRecipes).toHaveBeenCalledTimes(1);
  });

  it("re-fetche pour un autre utilisateur (cache indexé par uid)", async () => {
    fetchPublicRecipes.mockResolvedValue([{ pubId: "other" }]);
    const user = { uid: "u_other" };
    const { result } = renderHook(() => useDiscoverRecipes(user));
    await waitFor(() => expect(result.current.loadedOnce).toBe(true));
    expect(fetchPublicRecipes).toHaveBeenCalledTimes(1);
  });

  it("ne charge rien sans utilisateur", () => {
    const { result } = renderHook(() => useDiscoverRecipes(null));
    expect(fetchPublicRecipes).not.toHaveBeenCalled();
    expect(result.current.recipes).toEqual([]);
  });
});
