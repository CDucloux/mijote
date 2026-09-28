import { describe, it, expect } from "vitest";
import { soloWorkspace, householdWorkspace } from "@/lib/household/workspace.js";

describe("workspace", () => {
  it("solo résout vers users/{uid}", () => {
    const ws = soloWorkspace("u123");
    expect(ws.kind).toBe("solo");
    expect(ws.id).toBe("u123");
    expect(ws.segments).toEqual(["users", "u123"]);
  });

  it("foyer résout vers households/{hid}", () => {
    const ws = householdWorkspace("h456");
    expect(ws.kind).toBe("household");
    expect(ws.id).toBe("h456");
    expect(ws.segments).toEqual(["households", "h456"]);
  });
});
