// Server-only resolver: what a member is allowed to do in the blog CMS.
// The database blog_writer_access_state function is the source of truth for
// the *mode*; this module maps the mode to per-action capabilities.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
  reason: string | null;
};

export async function resolveBlogAccess(userId: string): Promise<BlogAccess> {
  const { data, error } = await supabaseAdmin.rpc("blog_writer_access_state", {
    _user_id: userId,
  });
  if (error) throw new Error(error.message);
  const mode = (data as BlogAccessMode | null) ?? "free";

  switch (mode) {
    case "plus":
    case "granted":
      return {
        mode,
        canCreateDraft: true,
        canPublish: true,
        canEditExisting: true,
        canUnpublish: true,
        canDeleteNeverPublishedDraft: true,
        activeDraftLimit: null,
        reason: null,
      };
    case "trial":
      return {
        mode,
        canCreateDraft: true,
        canPublish: false,
        canEditExisting: true,
        canUnpublish: false,
        canDeleteNeverPublishedDraft: true,
        activeDraftLimit: 1,
        reason:
          "Your article is saved. Public publishing begins with an active Plus membership or a Workshop publishing invitation.",
      };
    case "lapsed":
      return {
        mode,
        canCreateDraft: false,
        canPublish: false,
        canEditExisting: true,
        canUnpublish: true,
        canDeleteNeverPublishedDraft: true,
        activeDraftLimit: 0,
        reason:
          "Your Plus membership isn't active. You can edit or unpublish existing posts; publishing new ones needs Plus or a writer invitation.",
      };
    case "suspended":
      return {
        mode,
        canCreateDraft: false,
        canPublish: false,
        canEditExisting: false,
        canUnpublish: true,
        canDeleteNeverPublishedDraft: true,
        activeDraftLimit: 0,
        reason: "Publishing access is paused. You can unpublish existing posts.",
      };
    case "free":
    default:
      return {
        mode: "free",
        canCreateDraft: false,
        canPublish: false,
        canEditExisting: false,
        canUnpublish: false,
        canDeleteNeverPublishedDraft: false,
        activeDraftLimit: 0,
        reason: "Publishing on Workshop is a Plus feature.",
      };
  }
}
