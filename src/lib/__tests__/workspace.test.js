import { describe, it, expect } from "vitest";
import { soloWorkspace, householdWorkspace, isHousehold, workspaceId } from "@/lib/household/workspace.js";

describe("workspace", () => {
  it("solo résout vers users/{uid}", () => {
    const ws = soloWorkspace("u123");
    expect(ws.kind).toBe("solo");
    expect(ws.segments).toEqual(["users", "u123"]);
    expect(workspaceId(ws)).toBe("u123");
    expect(isHousehold(ws)).toBe(false);
  });

  it("foyer résout vers households/{hid}", () => {
    const ws = householdWorkspace("h456");
    expect(ws.kind).toBe("household");
    expect(ws.segments).toEqual(["households", "h456"]);
    expect(workspaceId(ws)).toBe("h456");
    expect(isHousehold(ws)).toBe(true);
  });

  it("workspaceId tolère null", () => {
    expect(workspaceId(null)).toBeNull();
    expect(isHousehold(null)).toBe(false);
  });
});
