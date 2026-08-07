import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { zodValidator } from "@tanstack/zod-adapter";

const legacySearch = z.object({
  tab: z.string().optional(),
  post: z.string().optional(),
  story: z.string().optional(),
});

/**
 * Legacy profile URL. Profiles now live at the root (/username); this route
 * exists only to forward old links, bookmarks, QR codes and indexed URLs,
 * preserving any tab/post/story query params.
 */
export const Route = createFileRoute("/u/$username")({
  validateSearch: zodValidator(legacySearch),
  beforeLoad: ({ params, search }) => {
    throw redirect({
      to: "/$username",
      params: { username: params.username },
      search: search as never,
      replace: true,
    });
  },
});
