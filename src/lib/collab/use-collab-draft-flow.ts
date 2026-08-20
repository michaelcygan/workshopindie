/**
 * Draft-first Collab authoring, shared by `/collab/new` and `/start-a-collab`.
 *
 * A signed-out visitor can fill in the whole composer; the draft is persisted
 * tab-scoped, the visitor is handed to signup, and the draft auto-publishes
 * once they come back signed in. UTM params survive the round trip.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { setPostAuthIntent } from "@/lib/post-auth-intent";
import { gtagEvent } from "@/lib/analytics/google";
import { workshopEntityUrl } from "@/lib/entities/kinds";
import {
  clearCollabDraft,
  loadCollabDraft,
  markDraftPublished,
  newDraftToken,
  readUtmParams,
  saveCollabDraft,
  wasDraftPublished,
  withUtm,
  type CollabDraft,
  type StoredCollabDraft,
} from "@/lib/collab-draft";

type Options = {
  /** Same-origin path the visitor returns to after creating an account. */
  returnTo: string;
  /** Analytics namespace, e.g. "collab_landing" or "collab_new". */
  source: string;
  /** Called after a successful publish, after the draft has been cleared. */
  onPublished?: (slug: string) => void;
};

export type CollabDraftFlow = {
  stored: StoredCollabDraft | null;
  /** True when a saved draft is ready to publish itself now that we're signed in. */
  resumePublish: boolean;
  /** Props to spread onto <CollabComposer />. */
  composerProps: {
    initialDraft: CollabDraft | null;
    onDraftChange: (draft: CollabDraft) => void;
    onRequireAuth?: (draft: CollabDraft) => void;
    autoSubmit: boolean;
    submitLabel: string;
    helperNote?: string;
    onPosted: (slug: string) => void;
  };
};

export function useCollabDraftFlow({ returnTo, source, onPublished }: Options): CollabDraftFlow {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [stored] = useState<StoredCollabDraft | null>(() => loadCollabDraft());
  const tokenRef = useRef<string>(stored?.token ?? newDraftToken());
  const utmRef = useRef<Record<string, string>>(stored?.utm ?? {});
  const startedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fresh = readUtmParams(window.location.search);
    if (Object.keys(fresh).length > 0) utmRef.current = fresh;
  }, []);

  const resumePublish = !!stored?.pendingPublish && !!user && !wasDraftPublished(tokenRef.current);

  useEffect(() => {
    if (resumePublish) gtagEvent("login", { method: `${source}_resume` });
  }, [resumePublish, source]);

  const persist = useCallback((draft: CollabDraft, pendingPublish: boolean) => {
    saveCollabDraft({ draft, token: tokenRef.current, pendingPublish, utm: utmRef.current });
  }, []);

  const onDraftChange = useCallback(
    (draft: CollabDraft) => {
      if (!draft.title.trim() && !draft.description.trim()) return;
      if (!startedRef.current) {
        startedRef.current = true;
        gtagEvent("select_content", { content_type: source, item_id: "form_started" });
      }
      persist(draft, false);
    },
    [persist, source],
  );

  const onRequireAuth = useCallback(
    (draft: CollabDraft) => {
      persist(draft, true);
      gtagEvent("select_content", { content_type: source, item_id: "continue_to_publish" });
      gtagEvent("sign_up", { method: `${source}_start` });
      const dest = withUtm(returnTo, utmRef.current);
      setPostAuthIntent({ kind: "return_to", returnTo: dest });
      navigate({ to: "/signup", search: { from: source, redirect: dest } as never });
    },
    [navigate, persist, returnTo, source],
  );

  const onPosted = useCallback(
    (slug: string) => {
      markDraftPublished(tokenRef.current);
      clearCollabDraft();
      gtagEvent("select_content", {
        content_type: source,
        item_id: "collab_published",
        ...utmRef.current,
      });
      const url =
        typeof window !== "undefined"
          ? `${window.location.origin}${workshopEntityUrl({ kind: "collab", slug })}`
          : "";
      toast.success("Your Collab is live — share the link.", {
        action: url
          ? {
              label: "Copy link",
              onClick: () => void navigator.clipboard.writeText(url).catch(() => {}),
            }
          : undefined,
      });
      if (onPublished) onPublished(slug);
      else navigate({ to: "/collab/$slug", params: { slug } });
    },
    [navigate, onPublished, source],
  );

  return {
    stored,
    resumePublish,
    composerProps: {
      initialDraft: stored?.draft ?? null,
      onDraftChange,
      onRequireAuth: user ? undefined : onRequireAuth,
      autoSubmit: resumePublish,
      submitLabel: user ? "Publish Collab" : "Continue to publish",
      helperNote: user
        ? undefined
        : "Draft now — you only need a free account to publish.",
      onPosted,
    },
  };
}
