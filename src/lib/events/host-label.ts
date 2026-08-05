/**
 * Who is actually throwing this event?
 *
 * A city Group (Chicago, New York…) is a shelf, not a host. When a seeded or
 * third-party listing lives on one, "Hosted by Chicago" is wrong — credit the
 * external organizer when we have one, and fall back to the event's own name
 * when we don't. Real community/member Groups still host their own events.
 */
export type EventHostGroup = {
  slug?: string | null;
  name?: string | null;
  avatar_url?: string | null;
  /** groups.kind — 'city' marks a system city shelf. */
  kind?: string | null;
};

export type EventHost =
  | { kind: "organizer"; label: string; href: string | null; group: null }
  | { kind: "group"; label: string; href: null; group: EventHostGroup }
  | { kind: "self"; label: string; href: null; group: null };

export function resolveEventHost(input: {
  title?: string | null;
  external_organizer?: string | null;
  external_url?: string | null;
  group?: EventHostGroup | null;
}): EventHost {
  const organizer = input.external_organizer?.trim();
  if (organizer) {
    return { kind: "organizer", label: organizer, href: input.external_url || null, group: null };
  }

  const group = input.group ?? null;
  const isShelf = !group?.name || group.kind === "city";
  if (!isShelf) {
    return { kind: "group", label: group!.name as string, href: null, group: group! };
  }

  return { kind: "self", label: input.title?.trim() || group?.name || "the organizer", href: null, group: null };
}
