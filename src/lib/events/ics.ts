/**
 * RFC 5545 helpers — the whole of Workshop's calendar formatting.
 *
 * Deliberately small: one escape function, one folder, one timestamp
 * formatter, one file builder. No dependency, no provider-specific logic.
 * The public .ics endpoint is the only consumer.
 */

/** Escape a TEXT value per RFC 5545 §3.3.11. */
export function escapeIcsText(input: string): string {
  return (
    input
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r\n/g, "\\n")
      .replace(/[\r\n]/g, "\\n")
      // Strip control characters calendars reject (tabs included).
      // eslint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]/g, " ")
  );
}

/**
 * Fold a content line to 75 octets per RFC 5545 §3.1, continuing with
 * CRLF + a single space. Counts UTF-8 bytes and never splits a character.
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      out.push(current);
      current = char;
      bytes = size;
      limit = 74; // continuation lines carry a leading space
    } else {
      current += char;
      bytes += size;
    }
  }
  out.push(current);
  return out.join("\r\n ");
}

/** UTC stamp in the basic format calendars expect: 20260807T013000Z. */
export function icsUtcStamp(value: string | number | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  return d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

/** Safe, readable download filename: workshop-open-mic.ics */
export function icsFilename(slug: string | null | undefined): string {
  const base = (slug ?? "event")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `workshop-${base || "event"}.ics`;
}

export type IcsEventInput = {
  /** Stable Workshop event id — becomes the UID. */
  uid: string;
  title: string;
  description?: string | null;
  location?: string | null;
  /** Canonical Workshop event page URL. Never a private meeting link. */
  url: string;
  start: string | number | Date;
  end: string | number | Date;
  /** Emits STATUS:CANCELLED so subscribers see the cancellation. */
  canceled?: boolean;
  now?: Date;
};

/** Build a complete, single-event VCALENDAR document (CRLF terminated). */
export function buildIcsFile(ev: IcsEventInput): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Workshop//Events//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.uid}@workshopindie.com`,
    `DTSTAMP:${icsUtcStamp(ev.now ?? new Date())}`,
    `DTSTART:${icsUtcStamp(ev.start)}`,
    `DTEND:${icsUtcStamp(ev.end)}`,
    `SUMMARY:${escapeIcsText(ev.title)}`,
  ];
  if (ev.description) lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
  if (ev.location) lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
  lines.push(`URL:${escapeIcsText(ev.url)}`);
  if (ev.canceled) lines.push("STATUS:CANCELLED");
  lines.push("END:VEVENT", "END:VCALENDAR");

  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}
