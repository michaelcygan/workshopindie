import { describe, it, expect } from "vitest";
import { buildIcsFile, escapeIcsText, foldIcsLine, icsFilename, icsUtcStamp } from "./ics";

describe("escapeIcsText", () => {
  it("escapes the RFC 5545 special characters", () => {
    expect(escapeIcsText("a\\b")).toBe("a\\\\b");
    expect(escapeIcsText("Cass Cafe, Detroit; MI")).toBe("Cass Cafe\\, Detroit\\; MI");
    expect(escapeIcsText("line1\r\nline2\nline3")).toBe("line1\\nline2\\nline3");
  });

  it("strips control characters", () => {
    expect(escapeIcsText("bad\u0007title")).toBe("bad title");
  });
});

describe("foldIcsLine", () => {
  it("leaves short lines alone", () => {
    expect(foldIcsLine("SUMMARY:Open mic")).toBe("SUMMARY:Open mic");
  });

  it("folds long lines to 75 octets with a leading space", () => {
    const folded = foldIcsLine("DESCRIPTION:" + "x".repeat(300));
    const parts = folded.split("\r\n");
    expect(parts.length).toBeGreaterThan(1);
    expect(parts[0]!.length).toBe(75);
    for (const p of parts.slice(1)) expect(p.startsWith(" ")).toBe(true);
    expect(parts.join("").replace(/\s/g, "")).toBe("DESCRIPTION:" + "x".repeat(300));
  });

  it("never splits a multi-byte character", () => {
    const folded = foldIcsLine("SUMMARY:" + "é".repeat(80));
    for (const part of folded.split("\r\n")) {
      expect(new TextEncoder().encode(part).length).toBeLessThanOrEqual(75);
    }
    expect(folded).not.toContain("\uFFFD");
  });
});

describe("icsUtcStamp / icsFilename", () => {
  it("formats UTC stamps", () => {
    expect(icsUtcStamp("2026-08-07T01:30:00.000Z")).toBe("20260807T013000Z");
  });

  it("sanitizes filenames", () => {
    expect(icsFilename("Open Mic! @ Green Mill")).toBe("workshop-open-mic-green-mill.ics");
    expect(icsFilename(null)).toBe("workshop-event.ics");
  });
});

describe("buildIcsFile", () => {
  const file = buildIcsFile({
    uid: "abc-123",
    title: "Open Mic, Vol. 4",
    description:
      "Sign up at 7.\n\nView on Workshop: https://workshopindie.com/g/chicago/e/open-mic",
    location: "Green Mill, 4802 N Broadway, Chicago IL",
    url: "https://workshopindie.com/g/chicago/e/open-mic",
    start: "2026-08-07T01:00:00.000Z",
    end: "2026-08-07T04:00:00.000Z",
    now: new Date("2026-08-01T00:00:00.000Z"),
  });

  it("produces a valid, CRLF-terminated single event", () => {
    expect(file.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(file.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(file).toContain("UID:abc-123@workshopindie.com");
    expect(file).toContain("DTSTART:20260807T010000Z");
    expect(file).toContain("DTEND:20260807T040000Z");
    expect(file).toContain("SUMMARY:Open Mic\\, Vol. 4");
    expect(file).toContain("URL:https://workshopindie.com/g/chicago/e/open-mic");
    expect(file).not.toContain("STATUS:CANCELLED");
  });

  it("marks canceled events", () => {
    const canceled = buildIcsFile({
      uid: "x",
      title: "Called off",
      url: "https://workshopindie.com/g/chicago/e/x",
      start: "2026-08-07T01:00:00.000Z",
      end: "2026-08-07T02:00:00.000Z",
      canceled: true,
    });
    expect(canceled).toContain("STATUS:CANCELLED");
  });
});
