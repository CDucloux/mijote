import { describe, it, expect } from "vitest";
import { fmtTime } from "../format.js";

describe("fmtTime", () => {
  it("renders an em dash for null/undefined", () => {
    expect(fmtTime(null)).toBe("—");
    expect(fmtTime(undefined)).toBe("—");
  });

  it("keeps 0 as a real value (0m), not a dash", () => {
    expect(fmtTime(0)).toBe("0m");
  });

  it("renders minutes under an hour", () => {
    expect(fmtTime(5)).toBe("5m");
    expect(fmtTime(59)).toBe("59m");
  });

  it("renders whole hours without minutes", () => {
    expect(fmtTime(60)).toBe("1h");
    expect(fmtTime(120)).toBe("2h");
  });

  it("zero-pads the minutes part of an h+m time", () => {
    expect(fmtTime(65)).toBe("1h05");
    expect(fmtTime(90)).toBe("1h30");
    expect(fmtTime(125)).toBe("2h05");
  });
});
