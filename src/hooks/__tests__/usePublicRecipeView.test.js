// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

vi.mock("../../lib/firestore.js", () => ({ fetchPublicDocsByIds: vi.fn() }));
import { fetchPublicDocsByIds } from "../../lib/firestore.js";
import { usePublicRecipeView } from "../usePublicRecipeView.js";

const loc = (pathname) => ({ pathname });
const PUB = { pubId: "u1__r1", authorUid: "u1", originalId: "r1", recipe: { id: "r1", name: "Tarte" }, componentRefs: [] };

function setup({ pathname = "/home", recipes = [], user = { uid: "me" } } = {}) {
  const navigate = vi.fn();
  const props = { user, recipes, location: loc(pathname), navigate };
  const view = renderHook((p) => usePublicRecipeView(p), { initialProps: props });
  return { ...view, navigate };
}

describe("usePublicRecipeView", () => {
  beforeEach(() => fetchPublicDocsByIds.mockReset());

  it("pubId null et docs null hors route /discover", () => {
    const { result } = setup({ pathname: "/home" });
    expect(result.current.pubId).toBeNull();
    expect(result.current.docs).toBeNull();
    expect(fetchPublicDocsByIds).not.toHaveBeenCalled();
  });

  it("accès direct : charge le doc public puis ses composants", async () => {
    const withComp = { ...PUB, componentRefs: ["c1"] };
    fetchPublicDocsByIds
      .mockResolvedValueOnce([withComp])                               // le doc principal
      .mockResolvedValueOnce([{ recipe: { id: "c1", name: "Pâte" } }]); // ses composants
    const { result } = setup({ pathname: "/discover/u1__r1" });
    expect(result.current.docs).toBeUndefined(); // chargement
    await waitFor(() => expect(result.current.docs).toBeTruthy());
    expect(result.current.docs.pub).toEqual(withComp);
    expect(result.current.docs.components).toEqual([{ id: "c1", name: "Pâte" }]);
    expect(fetchPublicDocsByIds).toHaveBeenNthCalledWith(2, ["u1__c1"]);
  });

  it("doc introuvable → docs null", async () => {
    fetchPublicDocsByIds.mockResolvedValueOnce([]);
    const { result } = setup({ pathname: "/discover/u1__r1" });
    await waitFor(() => expect(result.current.docs).toBeNull());
  });

  it("erreur réseau → docs null (pas de crash)", async () => {
    fetchPublicDocsByIds.mockRejectedValueOnce(new Error("offline"));
    const { result } = setup({ pathname: "/discover/u1__r1" });
    await waitFor(() => expect(result.current.docs).toBeNull());
  });

  it("open() d'une recette qui m'appartient route vers ma version locale éditable", () => {
    const { result, navigate } = setup({ recipes: [{ id: "r1" }], user: { uid: "u1" } });
    act(() => result.current.open(PUB));
    expect(navigate).toHaveBeenCalledWith("/recipes/r1", { state: { fromPath: "/home" } });
  });

  it("open() d'une recette d'autrui précharge et n'entraîne aucun fetch au rendu suivant", async () => {
    const { result, rerender, navigate } = setup({ user: { uid: "me" } });
    act(() => result.current.open(PUB, [{ id: "c1" }]));
    expect(navigate).toHaveBeenCalledWith("/discover/u1__r1");
    // La navigation amène sur /discover/u1__r1 : le doc préchargé est servi sans refetch.
    rerender({ user: { uid: "me" }, recipes: [], location: loc("/discover/u1__r1"), navigate });
    expect(result.current.docs).toEqual({ pub: PUB, components: [{ id: "c1" }] });
    await Promise.resolve();
    expect(fetchPublicDocsByIds).not.toHaveBeenCalled();
  });
});
