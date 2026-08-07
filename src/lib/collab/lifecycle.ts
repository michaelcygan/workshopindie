/**
 * Collab lifecycle — the single source of truth.
 *
 * There are only two creative states: In Progress and Published.
 * Archived is an owner management state, not a creative phase.
 * State is always derived from the record; it is never manually selectable.
 *
 * Recruitment ("accepting collaborators") is independent of lifecycle state.
 */

export type CollabLifecycleState = "in_progress" | "published" | "archived";

export type CollabLifecycleRecord = {
  status?: string | null;
  archived_at?: string | null;
  resulting_work_id?: string | null;
  applications_open?: boolean | null;
  ends_on?: string | null;
};

/** Legacy statuses that mean "not a live public record". */
export const LEGACY_ARCHIVED_STATUSES = ["archived", "removed"] as const;

export function collabLifecycleState(post: CollabLifecycleRecord): CollabLifecycleState {
  if (
    post.archived_at ||
    (post.status && (LEGACY_ARCHIVED_STATUSES as readonly string[]).includes(post.status))
  ) {
    return "archived";
  }
  if (post.resulting_work_id) return "published";
  return "in_progress";
}

export function lifecycleLabel(state: CollabLifecycleState): string {
  switch (state) {
    case "published":
      return "Published";
    case "archived":
      return "Archived";
    default:
      return "In Progress";
  }
}

const todayISO = () => new Date().toISOString().slice(0, 10);

/** Has the submission deadline passed? Deadline is inclusive of its own day. */
export function deadlinePassed(endsOn: string | null | undefined, today = todayISO()): boolean {
  if (!endsOn) return false;
  return endsOn < today;
}

/**
 * Whether the Collab is actually taking new collaborators right now.
 * Pausing submissions never changes the lifecycle state.
 */
export function effectiveApplicationsOpen(
  post: CollabLifecycleRecord,
  today = todayISO(),
): boolean {
  return (
    collabLifecycleState(post) === "in_progress" &&
    post.applications_open === true &&
    !deadlinePassed(post.ends_on ?? null, today)
  );
}

/** Legacy private drafts stay private until their owner explicitly shares them. */
export function isLegacyPrivateDraft(post: CollabLifecycleRecord): boolean {
  return post.status === "draft";
}

/** Can anonymous / signed-out visitors see this Collab at all? */
export function isPubliclyVisible(post: CollabLifecycleRecord): boolean {
  if (isLegacyPrivateDraft(post)) return false;
  const state = collabLifecycleState(post);
  return state === "in_progress" || state === "published";
}

/** Should this Collab appear on the opportunity Board / discovery surfaces? */
export function isDiscoverableOpportunity(
  post: CollabLifecycleRecord,
  today = todayISO(),
): boolean {
  return isPubliclyVisible(post) && effectiveApplicationsOpen(post, today);
}

/** Should search engines index the public page? */
export function shouldIndex(post: CollabLifecycleRecord): boolean {
  return isPubliclyVisible(post);
}

export type RecruitmentState =
  | "accepting"
  | "paused"
  | "deadline_passed"
  | "published"
  | "archived";

export function recruitmentState(
  post: CollabLifecycleRecord,
  today = todayISO(),
): RecruitmentState {
  const state = collabLifecycleState(post);
  if (state === "archived") return "archived";
  if (state === "published") return "published";
  if (deadlinePassed(post.ends_on ?? null, today)) return "deadline_passed";
  return post.applications_open === true ? "accepting" : "paused";
}

export function recruitmentLabel(state: RecruitmentState): string {
  switch (state) {
    case "accepting":
      return "Accepting collaborators";
    case "paused":
      return "Submissions paused";
    case "deadline_passed":
      return "Deadline passed";
    case "published":
      return "Published";
    case "archived":
      return "Archived";
  }
}

/** "You · No collaborators yet" / "You + 2 collaborators" */
export function teamLabel(acceptedCount: number): string {
  if (acceptedCount <= 0) return "You · No collaborators yet";
  return `You + ${acceptedCount} collaborator${acceptedCount === 1 ? "" : "s"}`;
}

export function applicationCountLabel(count: number, noun: "application" | "pitch"): string {
  const plural = noun === "pitch" ? "pitches" : "applications";
  return `${count} ${count === 1 ? noun : plural}`;
}

export type CollabReviewStatus =
  | "new"
  | "reviewing"
  | "accepted"
  | "declined"
  | "withdrawn"
  | "spam";

export const REVIEW_STATUSES: CollabReviewStatus[] = [
  "new",
  "reviewing",
  "accepted",
  "declined",
  "withdrawn",
  "spam",
];

/** Legacy guest status -> shared review vocabulary. */
export function normalizeGuestReviewStatus(status: string | null | undefined): CollabReviewStatus {
  switch (status) {
    case "contacted":
      return "reviewing";
    case "hidden":
      return "declined";
    case "spam":
      return "spam";
    default:
      return "new";
  }
}

/** Server-side gate shared by every application entry point. */
export function applicationRejectionReason(
  post: CollabLifecycleRecord,
  today = todayISO(),
): string | null {
  const state = collabLifecycleState(post);
  if (state === "archived") return "This Collab has been archived.";
  if (state === "published") return "This Collab has already published its Work.";
  if (deadlinePassed(post.ends_on ?? null, today)) {
    return "The deadline for this Collab has passed.";
  }
  if (post.applications_open !== true) {
    return "This project is in progress, but it is not accepting new collaborators right now.";
  }
  return null;
}

/**
 * Does this Collab count against the Free-tier concurrent Collab cap?
 * Mirrors the `enforce_collabs_quota` trigger exactly: only Collabs that are
 * in progress AND still accepting collaborators are counted.
 */
export function countsTowardCollabQuota(post: CollabLifecycleRecord): boolean {
  return collabLifecycleState(post) === "in_progress" && post.applications_open === true;
}
