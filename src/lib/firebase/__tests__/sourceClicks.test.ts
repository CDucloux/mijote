import { describe, it, expect, vi, beforeEach } from "vitest";

const { setDoc, getDocs, authState } = vi.hoisted(() => ({
  setDoc: vi.fn((..._args: unknown[]) => Promise.resolve()),
  getDocs: vi.fn(),
  authState: { currentUser: { uid: "u1" } as { uid: string } | null },
}));

vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, col: string, id: string) => ({ path: `${col}/${id}` }),
  collection: (_db: unknown, col: string) => ({ col }),
  where: (field: string, op: string, value: string) => ({ field, op, value }),
  query: (col: unknown, ...clauses: unknown[]) => ({ col, clauses }),
  increment: (n: number) => ({ increment: n }),
  setDoc: (...args: unknown[]) => setDoc(...args),
  getDocs: (...args: unknown[]) => getDocs(...args),
}));
vi.mock("@/lib/firebase/firebase.js", () => ({ db: {}, auth: authState }));

import { recordSourceClick, fetchSourceClicks } from "../sourceClicks.js";

const NOW = new Date("2026-10-04T10:00:00Z");

beforeEach(() => {
  setDoc.mockClear();
  getDocs.mockReset();
  authState.currentUser = { uid: "u1" };
});

describe("recordSourceClick", () => {
  it("incrémente le compteur domaine__mois de 1", async () => {
    await recordSourceClick("https://www.cestmafournee.com/tarte", NOW);
    expect(setDoc).toHaveBeenCalledWith(
      { path: "sourceClicks/cestmafournee.com__2026-10" },
      { host: "cestmafournee.com", month: "2026-10", count: { increment: 1 } },
      { merge: true },
    );
  });

  it("n'écrit rien sans session (visiteur d'une recette publique)", async () => {
    authState.currentUser = null;
    await recordSourceClick("https://cestmafournee.com", NOW);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("n'écrit rien pour une source non web ou vide", async () => {
    await recordSourceClick("Livre de mamie", NOW);
    await recordSourceClick(undefined, NOW);
    expect(setDoc).not.toHaveBeenCalled();
  });

  it("avale une écriture refusée (le lien s'ouvre quoi qu'il arrive)", async () => {
    setDoc.mockImplementationOnce(() => Promise.reject(new Error("permission-denied")));
    await expect(recordSourceClick("https://site.fr", NOW)).resolves.toBeUndefined();
  });
});

describe("fetchSourceClicks", () => {
  it("renvoie les compteurs valides du mois et ignore les documents malformés", async () => {
    getDocs.mockResolvedValue({
      docs: [
        { data: () => ({ host: "cestmafournee.com", month: "2026-10", count: 12 }) },
        { data: () => ({ host: "x.fr", count: "beaucoup" }) },
        { data: () => null },
      ],
    });
    expect(await fetchSourceClicks("2026-10")).toEqual([{ host: "cestmafournee.com", month: "2026-10", count: 12 }]);
  });
});
