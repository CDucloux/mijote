import { describe, it, expect } from "vitest";
import { compareSemver, parseAppConfig, evaluateAppGuard } from "../appGuard.js";

describe("compareSemver", () => {
  it("ordonne les versions x.y.z", () => {
    expect(compareSemver("4.53.1", "4.53.2")).toBe(-1);
    expect(compareSemver("4.53.2", "4.53.1")).toBe(1);
    expect(compareSemver("4.53.1", "4.53.1")).toBe(0);
    expect(compareSemver("3.11.1", "4.0.0")).toBe(-1);
    expect(compareSemver("4.9.0", "4.10.0")).toBe(-1); // comparaison numérique, pas lexicale
  });

  it("ignore un suffixe pré-release/build", () => {
    expect(compareSemver("4.53.1-beta.2", "4.53.1")).toBe(0);
  });

  it("retourne null si une version est illisible", () => {
    expect(compareSemver("abc", "4.53.1")).toBeNull();
    expect(compareSemver("4.53", "4.53.1")).toBeNull();
    expect(compareSemver(undefined, "4.53.1")).toBeNull();
  });
});

describe("parseAppConfig", () => {
  it("valide et ne garde que les champs bien formés", () => {
    expect(parseAppConfig({ minimumVersion: "4.53.2", allowedHosts: ["cardamome.studio"] }))
      .toEqual({ minimumVersion: "4.53.2", allowedHosts: ["cardamome.studio"] });
  });

  it("écarte une version minimale invalide et une allowlist non exploitable", () => {
    expect(parseAppConfig({ minimumVersion: "nope", allowedHosts: [1, "", "  "] })).toEqual({});
    expect(parseAppConfig({ allowedHosts: [] })).toEqual({});
  });

  it("retourne null sur un payload non exploitable", () => {
    expect(parseAppConfig(null)).toBeNull();
    expect(parseAppConfig("x")).toBeNull();
    expect(parseAppConfig(42)).toBeNull();
  });
});

describe("evaluateAppGuard", () => {
  const base = { currentVersion: "4.53.1", host: "cardamome.studio" };

  it("autorise sans config (fail-open)", () => {
    expect(evaluateAppGuard({ ...base, config: null })).toEqual({ ok: true });
  });

  it("bloque un client sous la version minimale", () => {
    expect(evaluateAppGuard({ currentVersion: "3.11.1", host: "cardamome.studio", config: { minimumVersion: "4.53.1" } }))
      .toEqual({ ok: false, reason: "stale-version" });
  });

  it("autorise un client >= version minimale", () => {
    expect(evaluateAppGuard({ ...base, config: { minimumVersion: "4.53.1" } })).toEqual({ ok: true });
  });

  it("bloque un hôte hors allowlist", () => {
    expect(evaluateAppGuard({ currentVersion: "4.53.1", host: "mijote-sand.vercel.app", config: { allowedHosts: ["cardamome.studio", "localhost"] } }))
      .toEqual({ ok: false, reason: "foreign-host" });
  });

  it("autorise un hôte présent dans l'allowlist (dont l'app native Capacitor sur localhost)", () => {
    expect(evaluateAppGuard({ currentVersion: "4.53.1", host: "localhost", config: { allowedHosts: ["cardamome.studio", "localhost"] } }))
      .toEqual({ ok: true });
  });

  it("ne contrôle pas l'hôte si l'allowlist est absente (fail-open)", () => {
    expect(evaluateAppGuard({ currentVersion: "4.53.1", host: "n-importe-quoi", config: { minimumVersion: "4.0.0" } }))
      .toEqual({ ok: true });
  });

  it("priorise la version sur l'hôte quand les deux échouent", () => {
    expect(evaluateAppGuard({ currentVersion: "3.11.1", host: "mijote-sand.vercel.app", config: { minimumVersion: "4.53.1", allowedHosts: ["cardamome.studio"] } }))
      .toEqual({ ok: false, reason: "stale-version" });
  });
});
