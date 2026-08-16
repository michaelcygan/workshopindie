/**
 * Tab-scoped persistence for a *complete* Collab draft.
 *
 * The /start-a-collab acquisition page lets a logged-out visitor fill in the
 * real Collab composer before creating an account. The whole draft (not just
 * title/description like the generic form stash) has to survive the signup /
 * OAuth round trip and any required onboarding, then publish exactly once.
 */
import type { FieldId } from "@/lib/taxonomy";
import type { CityValue } from "@/components/city-combobox";
import type { TimelineValue } from "@/components/timeline-picker";
import type { PickerGroup } from "@/components/group-picker";

export type CollabDraft = {
  title: string;
  category: FieldId;
  extraCategories: FieldId[];
  subcategory: string | null;
  description: string;
  timeline: TimelineValue;
  timelineNote: string;
  locationMode: "online" | "in_person" | "hybrid";
  city: CityValue | null;
  alsoCities: CityValue[];
  comp: "paid" | "unpaid" | "credit" | "negotiable" | "unspecified";
  contactMode: "email_relay" | "external_link";
  externalUrl: string;
  roles: { role_name: string; quantity: number; description: string }[];
  rights: "owner_retains" | "equal_split" | "creative_commons" | "decide_later";
  groups: PickerGroup[];
};

export type StoredCollabDraft = {
  draft: CollabDraft;
  /** One-shot token: publishing clears it, so a refresh can't double-post. */
  token: string;
  /** Set when the visitor pressed "Continue to publish" and went to auth. */
  pendingPublish: boolean;
  /** UTM params captured on arrival, carried through the auth round trip. */
  utm: Record<string, string>;
  savedAt: number;
};

const KEY = "workshop:collab-landing-draft:v1";
/** Six hours is long enough for an email-confirmation detour. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function newDraftToken(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

export function saveCollabDraft(entry: Omit<StoredCollabDraft, "savedAt">): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify({ ...entry, savedAt: Date.now() }));
  } catch {
    /* storage full or unavailable */
  }
}

export function loadCollabDraft(): StoredCollabDraft | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredCollabDraft;
    if (!parsed?.draft || typeof parsed.draft !== "object") return null;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > MAX_AGE_MS) {
      s.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearCollabDraft(): void {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Records that a draft token already produced a Collab (belt + braces). */
const PUBLISHED_KEY = "workshop:collab-landing-published:v1";

export function markDraftPublished(token: string): void {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(PUBLISHED_KEY, token);
  } catch {
    /* ignore */
  }
}

export function wasDraftPublished(token: string): boolean {
  const s = storage();
  if (!s) return false;
  try {
    return s.getItem(PUBLISHED_KEY) === token;
  } catch {
    return false;
  }
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];

export function readUtmParams(searchString: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const params = new URLSearchParams(searchString);
    for (const k of UTM_KEYS) {
      const v = params.get(k);
      if (v) out[k] = v.slice(0, 120);
    }
  } catch {
    /* ignore */
  }
  return out;
}

/** Re-appends stored UTM params to a path so they survive the auth redirect. */
export function withUtm(path: string, utm: Record<string, string>): string {
  const entries = Object.entries(utm);
  if (entries.length === 0) return path;
  const [base, existing] = path.split("?");
  const params = new URLSearchParams(existing ?? "");
  for (const [k, v] of entries) if (!params.has(k)) params.set(k, v);
  return `${base}?${params.toString()}`;
}
