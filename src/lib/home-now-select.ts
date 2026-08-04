/**
 * Builds the three-lane "Now" board from the member home payload.
 *
 * Order of preference inside each lane: real activity → the member's own
 * continue actions → personalised contextual suggestions → evergreen seeds.
 * Selection is deterministic for a given session seed, so rows never reshuffle
 * on a re-render — only on rotation.
 */

import type { MemberHomePayload } from "./home-types";
import type { HomeNowBoard, HomeNowItem, HomeNowLane } from "./home-now-types";
import { resolveSeeds, type NowContext } from "./home-now-suggestions";

const COOLDOWN_KEY = "ws:now-board:recent";
const SEED_KEY = "ws:now-board:seed";
const COOLDOWN_MAX = 24;

/** One stable shuffle seed per browser session. */
export function sessionSeed(): number {
  if (typeof window === "undefined") return 1;
  try {
    const existing = window.sessionStorage.getItem(SEED_KEY);
    if (existing) return Number(existing) || 1;
    const seed = Math.floor(Math.random() * 2 ** 31) || 1;
    window.sessionStorage.setItem(SEED_KEY, String(seed));
    return seed;
  } catch {
    return 1;
  }
}

function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function readRecent(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(COOLDOWN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function markShown(id: string) {
  if (typeof window === "undefined") return;
  try {
    const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, COOLDOWN_MAX);
    window.sessionStorage.setItem(COOLDOWN_KEY, JSON.stringify(next));
  } catch {
    /* cooldown is a nicety, never a requirement */
  }
}

function daypart(hour: number): string {
  if (hour < 5) return "late night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "late night";
}

export function nowContext(data: MemberHomePayload, now = new Date()): NowContext {
  const group = data.today[0]
    ? { name: data.today[0].groupName, slug: data.today[0].groupSlug }
    : (data.nowGroups[0] ?? null);
  const work = data.mine.find((m) => m.kind === "work") ?? null;
  return {
    city: data.homeCity?.name ?? null,
    citySlug: data.homeCity?.slug ?? null,
    cityGroupSlug: data.homeCityGroup?.slug ?? null,
    medium: data.mediums[0] ?? null,
    group: group?.name ?? null,
    groupSlug: group?.slug ?? null,
    work: work?.title ?? null,
    workSlug: (work as { slug?: string } | null)?.slug ?? null,
    daypart: daypart(now.getHours()),
    hasWork: data.mine.some((m) => m.kind === "work"),
    hasGroups: data.nowGroups.length > 0,
    day: now.getDay(),
    hour: now.getHours(),
  };
}

function relativeTime(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  const mins = Math.round(diff / 60000);
  if (mins > 0) {
    if (mins < 60) return `in ${mins} min`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `in ${hrs}h`;
    return `in ${Math.round(hrs / 24)}d`;
  }
  const ago = -mins;
  if (ago < 1) return "just now";
  if (ago < 60) return `${ago} min ago`;
  const hrs = Math.round(ago / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Rows backed by something genuinely happening. */
function activityItems(data: MemberHomePayload): HomeNowItem[] {
  const out: HomeNowItem[] = [];

  for (const room of data.lounges) {
    if (room.liveCount <= 0) continue; // never claim live without presence
    out.push({
      id: `audio-${room.roomId}`,
      lane: "live",
      source: "audio",
      status: "AUDIO",
      title: room.title,
      detail: `${room.liveCount} live in ${room.groupName}`,
      isLive: true,
      to: "/g/$slug",
      params: { slug: room.groupSlug },
      weight: 100,
    });
  }

  for (const t of data.today) {
    out.push({
      id: `today-${t.groupId}`,
      lane: "live",
      source: "today",
      status: "TODAY",
      title: t.groupName,
      detail: t.latestBody
        ? `${t.latestBody.slice(0, 90)} · ${relativeTime(t.latestAt)}`
        : `${t.postCount} posts today`,
      to: "/g/$slug",
      params: { slug: t.groupSlug },
      weight: 80,
    });
  }

  for (const e of data.upcomingEvents) {
    out.push({
      id: `event-${e.id}`,
      lane: "live",
      source: "event",
      status: e.rsvped ? "YOU'RE GOING" : "UPCOMING",
      title: e.title,
      detail: [relativeTime(e.startsAt), e.venueName ?? e.cityName ?? e.groupName]
        .filter(Boolean)
        .join(" · "),
      to: "/g/$slug/e/$eventSlug",
      params: { slug: e.groupSlug, eventSlug: e.slug },
      weight: 60,
    });
  }

  return out;
}

/** The member's own unfinished business. */
function continueItems(data: MemberHomePayload): HomeNowItem[] {
  return data.continueActions.map((a, i) => ({
    id: `continue-${a.kind}-${i}`,
    lane: "make" as HomeNowLane,
    source: "continue" as const,
    status: a.actionLabel.toUpperCase().slice(0, 18),
    title: a.title,
    detail: a.detail ?? null,
    to: a.to,
    params: a.params as Record<string, string> | undefined,
    search: a.search as Record<string, string | number | boolean> | undefined,
    weight: 70 - i,
  }));
}

function orderLane(items: HomeNowItem[], seed: number, recent: Set<string>): HomeNowItem[] {
  const seen = new Set<string>();
  const unique = items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
  return unique
    .map((item) => {
      const jitter = (hash(`${item.id}:${seed}`) % 1000) / 1000;
      const penalty = recent.has(item.id) ? 12 : 0;
      return { item, score: item.weight + jitter - penalty };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.item);
}

/**
 * Build the board. Every lane is guaranteed non-empty via evergreen seeds.
 */
export function buildNowBoard(
  data: MemberHomePayload,
  seed: number,
  now = new Date(),
): HomeNowBoard {
  const ctx = nowContext(data, now);
  const recent = new Set(readRecent());
  const activity = activityItems(data);
  const cont = continueItems(data);
  const suggestions = resolveSeeds(ctx);

  const used = new Set<string>();
  const board = { live: [], make: [], explore: [] } as HomeNowBoard;

  for (const lane of ["live", "make", "explore"] as HomeNowLane[]) {
    const pool = [
      ...activity.filter((i) => i.lane === lane),
      ...cont.filter((i) => i.lane === lane),
      ...suggestions.filter((i) => i.lane === lane),
    ];
    const ordered = orderLane(pool, seed, recent).filter((i) => !used.has(i.id));
    const picked = ordered.slice(0, 8);
    for (const i of picked) used.add(i.id);
    board[lane] = picked.length
      ? picked
      : orderLane(suggestions.filter((i) => i.lane === lane), seed, new Set()).slice(0, 4);
  }

  return board;
}
