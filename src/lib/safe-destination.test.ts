import { describe, it, expect } from "vitest";
import { safeDestination, safeDestinationOrHome } from "./safe-destination";

describe("safeDestination", () => {
  it("accepts plain same-origin paths", () => {
    expect(safeDestination("/groups")).toBe("/groups");
  });

  it("preserves query strings", () => {
    expect(safeDestination("/me/blog?draft=1")).toBe("/me/blog?draft=1");
  });

  it("preserves hashes", () => {
    expect(safeDestination("/works/new#publish")).toBe("/works/new#publish");
  });

  it("rejects protocol-relative paths", () => {
    expect(safeDestination("//evil.example")).toBeNull();
  });

  it("rejects absolute URLs", () => {
    expect(safeDestination("https://evil.example")).toBeNull();
    expect(safeDestination("http://evil.example/x")).toBeNull();
  });

  it("rejects javascript: urls", () => {
    expect(safeDestination("javascript:alert(1)")).toBeNull();
  });

  it("rejects backslash tricks", () => {
    expect(safeDestination("/\\evil.example")).toBeNull();
    expect(safeDestination("\\\\evil.example")).toBeNull();
  });

  it("rejects control characters", () => {
    expect(safeDestination("/\tevil")).toBeNull();
    expect(safeDestination("/\nevil")).toBeNull();
    expect(safeDestination("/\u0000evil")).toBeNull();
  });

  it("rejects malformed encodings", () => {
    expect(safeDestination("/%E0%A4%A")).toBeNull();
    expect(safeDestination("/%zz")).toBeNull();
  });

  it("rejects encoded external redirect tricks", () => {
    expect(safeDestination("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
    expect(safeDestination("%2f%2fevil.example")).toBeNull();
    expect(safeDestination("https%3A%2F%2Fevil.example")).toBeNull();
  });

  it("rejects empty and non-string input", () => {
    expect(safeDestination("")).toBeNull();
    expect(safeDestination("   ")).toBeNull();
    expect(safeDestination(null)).toBeNull();
    expect(safeDestination(undefined)).toBeNull();
  });

  it("falls back to / for unsafe or missing destinations", () => {
    expect(safeDestinationOrHome(undefined)).toBe("/");
    expect(safeDestinationOrHome("//evil.example")).toBe("/");
    expect(safeDestinationOrHome("/groups")).toBe("/groups");
  });
});
