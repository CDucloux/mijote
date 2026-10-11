import { describe, it, expect, vi } from "vitest";
import { createSentrySink, toSentryUser } from "@/lib/observability/sentrySink.js";

const fakeSentry = () => ({ captureException: vi.fn(), addBreadcrumb: vi.fn(), setUser: vi.fn() });

describe("toSentryUser", () => {
  it("keeps only the uid, never the email", () => {
    expect(toSentryUser({ id: "u1", email: "a@b.c" })).toEqual({ id: "u1" });
  });
  it("returns null when signed out or without id", () => {
    expect(toSentryUser(null)).toBeNull();
    expect(toSentryUser({ id: "" })).toBeNull();
  });
});

describe("createSentrySink", () => {
  it("forwards errors with their context as extra", () => {
    const sentry = fakeSentry();
    const err = new Error("boom");
    createSentrySink(sentry).captureError(err, { where: "sync" });
    expect(sentry.captureException).toHaveBeenCalledWith(err, { extra: { where: "sync" } });
  });
  it("forwards errors without context", () => {
    const sentry = fakeSentry();
    createSentrySink(sentry).captureError("x");
    expect(sentry.captureException).toHaveBeenCalledWith("x", undefined);
  });
  it("turns events into info breadcrumbs", () => {
    const sentry = fakeSentry();
    createSentrySink(sentry).captureEvent?.("import:start", { kind: "url" });
    expect(sentry.addBreadcrumb).toHaveBeenCalledWith({ category: "app", message: "import:start", data: { kind: "url" }, level: "info" });
  });
  it("strips the email before setting the user", () => {
    const sentry = fakeSentry();
    const sink = createSentrySink(sentry);
    sink.setUser?.({ id: "u1", email: "a@b.c" });
    sink.setUser?.(null);
    expect(sentry.setUser.mock.calls).toEqual([[{ id: "u1" }], [null]]);
  });
});
