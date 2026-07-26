// Server-only resolver: what a member is allowed to do in the blog CMS.
// The database blog_writer_access_state function is the source of truth for
// the *mode*; this module maps the mode to per-action capabilities and
// layers the Free monthly publication quota on top.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { FREE_BLOG_PUBLICATIONS_PER_MONTH } from "@/lib/entitlements";

export type BlogAccessMode =
  | "free"
  | "trial"
  | "plus"
  | "granted"
  | "lapsed"
  | "suspended";

export type BlogAccess = {
  mode: BlogAccessMode;
  canCreateDraft: boolean;
  canPublish: boolean;
  canEditExisting: boolean;
  canUnpublish: boolean;
  canDeleteNeverPublishedDraft: boolean;
  activeDraftLimit: number | null; // null = unlimited
  /** Current-UTC-month publication count for this user (member posts only). */
  publicationsThisMonth: number;
  /** Monthly publish cap; null = unlimited (Plus / granted / trial). */
  monthlyPublicationLimit: number | null;
  reason: string | null;
};

function nextMonthResetLabel(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return next.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

function currentMonthLabel(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function fetchPublicationsThisMonth(userId: string): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc(
    "blog_member_publications_this_month",
    { _user_id: userId },
  );
  if (error) return 0;
  return typeof data === "number" ? data : 0;
}

export async function resolveBlogAccess(userId: string): Promise<BlogAccess> {
  const { data, error } = await supabaseAdmin.rpc("blog_writer_access_state", {
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  const mode = (data as BlogAccessMode | null) ?? "free";

  switch (mode) {
    case "plus":
    case "granted":
    case "trial": {
      // Trial gets the same publishing capabilities as active Plus. Every
      // other Plus feature already treats trial as full access; publishing
      // matches that.
      return {
        mode,
        canCreateDraft: true,
        canPublish: true,
        canEditExisting: true,
        canUnpublish: true,
        canDeleteNeverPublishedDraft: true,
        activeDraftLimit: null,
        publicationsThisMonth: await fetchPublicationsThisMonth(userId),
        monthlyPublicationLimit: null,
        reason: null,
      };
    }
    case "free":
    case "lapsed": {
      const used = await fetchPublicationsThisMonth(userId);
      const limit = FREE_BLOG_PUBLICATIONS_PER_MONTH;
      const atCap = used >= limit;
      const reason = atCap
        ? `You've published ${used} of ${limit} posts for ${currentMonthLabel()}. New publishing opens on ${nextMonthResetLabel()} (UTC).`
        : mode === "lapsed"
          ? "Your Plus membership isn't active. You can still publish up to 2 posts each month on Free."
          : null;
      return {
        mode,
        canCreateDraft: true,
        canPublish: !atCap,
        canEditExisting: true,
        canUnpublish: true,
        canDeleteNeverPublishedDraft: true,
        activeDraftLimit: null,
        publicationsThisMonth: used,
        monthlyPublicationLimit: limit,
        reason,
      };
    }
    case "suspended":
      return {
        mode,
        canCreateDraft: false,
        canPublish: false,
        canEditExisting: false,
        canUnpublish: true,
        canDeleteNeverPublishedDraft: true,
        activeDraftLimit: 0,
        publicationsThisMonth: await fetchPublicationsThisMonth(userId),
        monthlyPublicationLimit: 0,
        reason: "Publishing access is paused. You can unpublish existing posts.",
      };
    default:
      return {
        mode: "free",
        canCreateDraft: true,
        canPublish: false,
        canEditExisting: true,
        canUnpublish: true,
        canDeleteNeverPublishedDraft: true,
        activeDraftLimit: null,
        publicationsThisMonth: 0,
        monthlyPublicationLimit: FREE_BLOG_PUBLICATIONS_PER_MONTH,
        reason: null,
      };
  }
}
