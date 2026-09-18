import { describe, it, expect } from "vitest";
import { isBlockedIp } from "../urlGuard.js";

// Le classifieur d'IP est le cœur de la garde anti-SSRF : il doit bloquer TOUTE
// adresse non publiquement routable (et refuser par défaut les formes inconnues),
// tout en laissant passer les IP publiques normales.
describe("isBlockedIp — IPv4", () => {
  it("bloque loopback, privées, link-local, CGNAT et réservées", () => {
    for (const ip of [
      "127.0.0.1", "127.1.2.3",
      "10.0.0.1", "10.255.255.255",
      "172.16.0.1", "172.31.255.255",
      "192.168.0.1", "192.168.1.1",
      "169.254.169.254", // metadata cloud
      "100.64.0.1", "100.127.255.255", // CGNAT
      "0.0.0.0",
      "224.0.0.1", "255.255.255.255",
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it("laisse passer les IPv4 publiques", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.15.0.1", "172.32.0.1", "100.63.0.1", "100.128.0.1"]) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });
});

describe("isBlockedIp — IPv6", () => {
  it("bloque loopback, ULA, link-local et formes mappées IPv4 internes", () => {
    for (const ip of [
      "::1", "::",
      "fc00::1", "fd12:3456::1", // ULA
      "fe80::1", // link-local
      "::ffff:127.0.0.1", "::ffff:169.254.169.254", "::ffff:10.0.0.1", // mappées internes
    ]) {
      expect(isBlockedIp(ip), ip).toBe(true);
    }
  });

  it("laisse passer les IPv6 publiques (y compris mappée d'une IPv4 publique)", () => {
    for (const ip of ["2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8"]) {
      expect(isBlockedIp(ip), ip).toBe(false);
    }
  });
});

describe("isBlockedIp — entrées invalides", () => {
  it("refuse par défaut ce qui n'est pas une IP reconnue", () => {
    for (const v of ["", "localhost", "not-an-ip", "999.1.1.1", "12.34"]) {
      expect(isBlockedIp(v), v).toBe(true);
    }
  });
});
