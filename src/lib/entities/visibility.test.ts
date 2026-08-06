import { describe, it, expect } from "vitest";
import {
  isWorkPubliclyReferenceable,
  isCollabPubliclyReferenceable,
  isGroupPubliclyReferenceable,
  isEventPubliclyReferenceable,
  isProfilePubliclyReferenceable,
} from "./visibility";

const publicGroup = { visibility: "public", deleted_at: null };

describe("public referenceability", () => {
  it("only lets published + public Works into public context", () => {
    expect(isWorkPubliclyReferenceable({ status: "published", visibility: "public" })).toBe(true);
    expect(isWorkPubliclyReferenceable({ status: "published", visibility: "unlisted" })).toBe(false);
    expect(isWorkPubliclyReferenceable({ status: "published", visibility: "private" })).toBe(false);
    expect(isWorkPubliclyReferenceable({ status: "draft", visibility: "public" })).toBe(false);
  });

  it("treats a finished Collab as valid historical context but drops archived ones", () => {
    expect(isCollabPubliclyReferenceable({ status: "open", resulting_work_id: "w1" })).toBe(true);
    expect(isCollabPubliclyReferenceable({ status: "closed", applications_open: false })).toBe(true);
    expect(isCollabPubliclyReferenceable({ status: "open", archived_at: "2026-01-01" })).toBe(false);
    expect(isCollabPubliclyReferenceable({ status: "draft" })).toBe(false);
    expect(isCollabPubliclyReferenceable({ status: "removed" })).toBe(false);
  });

  it("hides unlisted and deleted Groups", () => {
    expect(isGroupPubliclyReferenceable(publicGroup)).toBe(true);
    expect(isGroupPubliclyReferenceable({ visibility: "unlisted", deleted_at: null })).toBe(false);
    expect(isGroupPubliclyReferenceable({ visibility: "public", deleted_at: "x" })).toBe(false);
  });

  it("keeps group-only and unlisted Events out of public context", () => {
    expect(isEventPubliclyReferenceable({ visibility: "public", deleted_at: null }, publicGroup)).toBe(true);
    expect(isEventPubliclyReferenceable({ visibility: "group_only", deleted_at: null }, publicGroup)).toBe(false);
    expect(isEventPubliclyReferenceable({ visibility: "unlisted", deleted_at: null }, publicGroup)).toBe(false);
    expect(isEventPubliclyReferenceable({ visibility: "public", deleted_at: "x" }, publicGroup)).toBe(false);
  });

  it("inherits the parent Group's visibility for Events", () => {
    expect(
      isEventPubliclyReferenceable({ visibility: "public", deleted_at: null }, { visibility: "unlisted", deleted_at: null }),
    ).toBe(false);
    expect(isEventPubliclyReferenceable({ visibility: "public", deleted_at: null }, null)).toBe(false);
  });

  it("respects profile discoverability", () => {
    expect(isProfilePubliclyReferenceable({ username: "jane", discoverable: true })).toBe(true);
    expect(isProfilePubliclyReferenceable({ username: "jane", discoverable: false })).toBe(false);
    expect(isProfilePubliclyReferenceable({ username: null, discoverable: true })).toBe(false);
  });
});
