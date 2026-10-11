import { describe, it, expect, vi, afterEach } from "vitest";
import { busyFloor, BUSY_FLOOR_MS } from "@/lib/ui/busyFloor.js";

afterEach(() => vi.useRealTimers());

describe("busyFloor", () => {
  it("resolves only once the default floor has elapsed", async () => {
    vi.useFakeTimers();
    let done = false;
    busyFloor().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(BUSY_FLOOR_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });

  it("accepts a custom delay and clamps negative values to zero", async () => {
    vi.useFakeTimers();
    let done = false;
    busyFloor(-50).then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(0);
    expect(done).toBe(true);
  });
});
