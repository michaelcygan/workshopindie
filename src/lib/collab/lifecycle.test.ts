import { describe, it, expect } from "vitest";
import {
  collabLifecycleState,
  lifecycleLabel,
  deadlinePassed,
  effectiveApplicationsOpen,
  isPubliclyVisible,
  isDiscoverableOpportunity,
  shouldIndex,
  recruitmentState,
  teamLabel,
  applicationCountLabel,
  normalizeGuestReviewStatus,
  applicationRejectionReason,
  countsTowardCollabQuota,
} from "./lifecycle";

const TODAY = "2026-08-04";
const base = { status: "open", applications_open: true } as const;

describe("collabLifecycleState", () => {
  it("is in_progress for a live recruiting collab", () => {
    expect(collabLifecycleState({ ...base })).toBe("in_progress");
  });
  it("is published once a Work exists", () => {
    expect(collabLifecycleState({ ...base, resulting_work_id: "w1" })).toBe("published");
  });
  it("is archived when archived_at is set, even with a Work", () => {
    expect(
      collabLifecycleState({ ...base, resulting_work_id: "w1", archived_at: "2026-01-01" }),
    ).toBe("archived");
  });
  it("maps legacy archived/removed statuses to archived", () => {
    expect(collabLifecycleState({ status: "archived" })).toBe("archived");
    expect(collabLifecycleState({ status: "removed" })).toBe("archived");
  });
  it("treats a legacy closed row with no Work as still in progress", () => {
    expect(collabLifecycleState({ status: "closed" })).toBe("in_progress");
  });
  it("labels states in product vocabulary", () => {
    expect(lifecycleLabel("in_progress")).toBe("In Progress");
    expect(lifecycleLabel("published")).toBe("Published");
    expect(lifecycleLabel("archived")).toBe("Archived");
  });
});

describe("deadlines", () => {
  it("is inclusive of the deadline day", () => {
    expect(deadlinePassed(TODAY, TODAY)).toBe(false);
    expect(deadlinePassed("2026-08-03", TODAY)).toBe(true);
    expect(deadlinePassed(null, TODAY)).toBe(false);
  });
});

describe("pause vs archive", () => {
  it("pausing keeps the collab In Progress but stops recruiting", () => {
    const paused = { ...base, applications_open: false };
    expect(collabLifecycleState(paused)).toBe("in_progress");
    expect(effectiveApplicationsOpen(paused, TODAY)).toBe(false);
    expect(recruitmentState(paused, TODAY)).toBe("paused");
    expect(isPubliclyVisible(paused)).toBe(true);
  });
  it("archiving hides it publicly and stops recruiting", () => {
    const archived = { ...base, archived_at: "2026-02-02" };
    expect(effectiveApplicationsOpen(archived, TODAY)).toBe(false);
    expect(recruitmentState(archived, TODAY)).toBe("archived");
    expect(isPubliclyVisible(archived)).toBe(false);
    expect(shouldIndex(archived)).toBe(false);
  });
  it("an expired deadline stops recruiting without changing state", () => {
    const expired = { ...base, ends_on: "2026-07-01" };
    expect(recruitmentState(expired, TODAY)).toBe("deadline_passed");
    expect(isDiscoverableOpportunity(expired, TODAY)).toBe(false);
    expect(isPubliclyVisible(expired)).toBe(true);
  });
});

describe("visibility and discovery", () => {
  it("legacy private drafts are never public and never indexed", () => {
    const draft = { status: "draft", applications_open: true };
    expect(isPubliclyVisible(draft)).toBe(false);
    expect(shouldIndex(draft)).toBe(false);
    expect(isDiscoverableOpportunity(draft, TODAY)).toBe(false);
  });
  it("published collabs stay public but are not opportunities", () => {
    const published = { ...base, resulting_work_id: "w1" };
    expect(isPubliclyVisible(published)).toBe(true);
    expect(shouldIndex(published)).toBe(true);
    expect(isDiscoverableOpportunity(published, TODAY)).toBe(false);
  });
  it("a live recruiting collab is discoverable", () => {
    expect(isDiscoverableOpportunity({ ...base, ends_on: "2026-12-01" }, TODAY)).toBe(true);
  });
});

describe("labels", () => {
  it("counts the team without inflating it", () => {
    expect(teamLabel(0)).toBe("You · No collaborators yet");
    expect(teamLabel(1)).toBe("You + 1 collaborator");
    expect(teamLabel(2)).toBe("You + 2 collaborators");
  });
  it("pluralises applications and pitches", () => {
    expect(applicationCountLabel(1, "application")).toBe("1 application");
    expect(applicationCountLabel(2, "application")).toBe("2 applications");
    expect(applicationCountLabel(1, "pitch")).toBe("1 pitch");
    expect(applicationCountLabel(3, "pitch")).toBe("3 pitches");
  });
});

describe("guest review status mapping", () => {
  it("maps legacy guest rows onto the shared vocabulary", () => {
    expect(normalizeGuestReviewStatus("contacted")).toBe("reviewing");
    expect(normalizeGuestReviewStatus("hidden")).toBe("declined");
    expect(normalizeGuestReviewStatus("spam")).toBe("spam");
    expect(normalizeGuestReviewStatus(null)).toBe("new");
    expect(normalizeGuestReviewStatus("anything-else")).toBe("new");
  });
});

describe("applicationRejectionReason", () => {
  it("allows applications while recruiting", () => {
    expect(applicationRejectionReason({ ...base }, TODAY)).toBeNull();
  });
  it("rejects archived, published, expired and paused collabs", () => {
    expect(applicationRejectionReason({ ...base, archived_at: "2026-01-01" }, TODAY)).toMatch(
      /archived/i,
    );
    expect(applicationRejectionReason({ ...base, resulting_work_id: "w1" }, TODAY)).toMatch(
      /published/i,
    );
    expect(applicationRejectionReason({ ...base, ends_on: "2026-01-01" }, TODAY)).toMatch(
      /deadline/i,
    );
    expect(applicationRejectionReason({ ...base, applications_open: false }, TODAY)).toMatch(
      /not accepting/i,
    );
  });
});

describe("free-tier quota counting", () => {
  it("counts an in-progress collab that is accepting collaborators", () => {
    expect(countsTowardCollabQuota({ ...base })).toBe(true);
  });
  it("does not count a paused collab", () => {
    expect(countsTowardCollabQuota({ ...base, applications_open: false })).toBe(false);
  });
  it("does not count a published collab", () => {
    expect(countsTowardCollabQuota({ ...base, resulting_work_id: "w1" })).toBe(false);
  });
  it("does not count an archived collab", () => {
    expect(countsTowardCollabQuota({ ...base, archived_at: "2026-01-01" })).toBe(false);
  });
});
