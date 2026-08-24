import { describe, it, expect, vi, beforeEach } from "vitest";

// Coquille mockée : on pilote `isNativePlatform` et on espionne les appels plugin.
const nativeRef = { value: false };
const schedule = vi.fn(() => Promise.resolve());
const cancel = vi.fn(() => Promise.resolve());
const checkPermissions = vi.fn(() => Promise.resolve({ display: "granted" }));
const requestPermissions = vi.fn(() => Promise.resolve({ display: "granted" }));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => nativeRef.value },
}));
vi.mock("@capacitor/local-notifications", () => ({
  LocalNotifications: { schedule, cancel, checkPermissions, requestPermissions },
}));

const {
  deriveNotifId, ensureTimerNotificationPermission,
  scheduleTimerNotification, cancelTimerNotification,
} = await import("@/lib/notifications/localNotifications.ts");

beforeEach(() => {
  nativeRef.value = false;
  schedule.mockClear(); cancel.mockClear();
  checkPermissions.mockClear(); requestPermissions.mockClear();
  checkPermissions.mockResolvedValue({ display: "granted" });
  requestPermissions.mockResolvedValue({ display: "granted" });
});

describe("deriveNotifId", () => {
  it("est déterministe et borné à un entier 31 bits positif", () => {
    const id = deriveNotifId("6-1000000-abc123");
    expect(id).toBe(deriveNotifId("6-1000000-abc123"));
    expect(Number.isInteger(id)).toBe(true);
    expect(id).toBeGreaterThanOrEqual(1);
    expect(id).toBeLessThanOrEqual(2147483647);
  });

  it("sépare des identifiants distincts", () => {
    expect(deriveNotifId("a")).not.toBe(deriveNotifId("b"));
  });
});

describe("hors natif (web / PWA)", () => {
  it("ne planifie ni n'annule rien, et refuse la permission", async () => {
    expect(await ensureTimerNotificationPermission()).toBe(false);
    await scheduleTimerNotification({ notifId: 1, title: "t", body: "b", at: new Date(Date.now() + 60_000) });
    await cancelTimerNotification(1);
    expect(schedule).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });
});

describe("en natif", () => {
  beforeEach(() => { nativeRef.value = true; });

  it("planifie une notification à l'échéance future", async () => {
    const at = new Date(Date.now() + 60_000);
    await scheduleTimerNotification({ notifId: 42, title: "Minuteur terminé", body: "6 min, étape 3", at });
    expect(schedule).toHaveBeenCalledTimes(1);
    const arg = schedule.mock.calls[0][0].notifications[0];
    expect(arg.id).toBe(42);
    expect(arg.schedule.at).toBe(at);
    expect(arg.schedule.allowWhileIdle).toBe(true);
  });

  it("ne planifie pas une échéance déjà passée", async () => {
    await scheduleTimerNotification({ notifId: 42, title: "t", body: "b", at: new Date(Date.now() - 1000) });
    expect(schedule).not.toHaveBeenCalled();
  });

  it("annule par identifiant", async () => {
    await cancelTimerNotification(42);
    expect(cancel).toHaveBeenCalledWith({ notifications: [{ id: 42 }] });
  });

  it("demande la permission quand elle n'est pas encore accordée", async () => {
    checkPermissions.mockResolvedValue({ display: "prompt" });
    requestPermissions.mockResolvedValue({ display: "granted" });
    expect(await ensureTimerNotificationPermission()).toBe(true);
    expect(requestPermissions).toHaveBeenCalledTimes(1);
  });

  it("ne redemande pas une permission déjà refusée", async () => {
    checkPermissions.mockResolvedValue({ display: "denied" });
    expect(await ensureTimerNotificationPermission()).toBe(false);
    expect(requestPermissions).not.toHaveBeenCalled();
  });

  it("avale les erreurs du plugin (l'alarme premier plan reste le filet)", async () => {
    schedule.mockRejectedValueOnce(new Error("boom"));
    await expect(
      scheduleTimerNotification({ notifId: 1, title: "t", body: "b", at: new Date(Date.now() + 60_000) }),
    ).resolves.toBeUndefined();
  });
});
