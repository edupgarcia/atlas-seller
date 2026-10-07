import { describe, expect, it } from "vitest";
import { effectiveAccess } from "./access";

const now = new Date("2026-10-05T12:00:00Z");

describe("effectiveAccess", () => {
  it("sem registro de acesso não libera", () => {
    expect(effectiveAccess(null, now)).toBe("none");
  });
  it("active sem expiração libera", () => {
    expect(effectiveAccess({ status: "active", expires_at: null }, now)).toBe("active");
  });
  it("active com expires_at no passado conta como expirado", () => {
    expect(effectiveAccess({ status: "active", expires_at: "2026-10-04T00:00:00Z" }, now)).toBe("expired");
  });
  it("active com expires_at no futuro libera", () => {
    expect(effectiveAccess({ status: "active", expires_at: "2026-12-01T00:00:00Z" }, now)).toBe("active");
  });
  it("suspended bloqueia", () => {
    expect(effectiveAccess({ status: "suspended", expires_at: null }, now)).toBe("suspended");
  });
  it("invited ainda não libera", () => {
    expect(effectiveAccess({ status: "invited", expires_at: null }, now)).toBe("invited");
  });
});
