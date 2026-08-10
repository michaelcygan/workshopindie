import { Suspense, lazy, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { setPostAuthIntent } from "@/lib/post-auth-intent";

/**
 * The Collab composer is a large module (role presets, taxonomy, pickers), so
 * it only enters the bundle once someone actually opens the sheet.
 */
const CollabComposer = lazy(() =>
  import("@/routes/collab.new").then((m) => ({ default: m.CollabComposer })),
);

type Props = {
  group: { id: string; slug: string; name: string };
  /** "button" for the empty state, "card" for the invitation under a list. */
  variant?: "button" | "card";
  className?: string;
};

/**
 * "Post a Collab to Chicago" — the group's own ask, opened in place so nobody
 * loses their filters or their scroll position to a full-page composer.
 */
export function PostCollabCta({ group, variant = "button", className }: Props) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  const label = `Post a Collab to ${group.name}`;
  const composerPath = `/collab/new?group=${encodeURIComponent(group.slug)}`;

  function start() {
    if (loading) return;
    if (!user) {
      // Remember where they were headed so signing in lands them back in this
      // group's composer instead of the homepage.
      setPostAuthIntent({ kind: "return_to", returnTo: composerPath });
      navigate({ to: "/login" });
      return;
    }
    setOpen(true);
  }

  function close() {
    setOpen(false);
  }

  function refresh() {
    qc.invalidateQueries({ queryKey: ["group", group.id, "collabs"] });
    qc.invalidateQueries({ queryKey: ["group", group.slug] });
  }

  const composer = (
    <Suspense
      fallback={
        <div className="space-y-3 p-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-surface-2" />
          ))}
        </div>
      }
    >
      <CollabComposer
        embed
        groupPreselectId={group.slug}
        onCancel={close}
        onPosted={(slug) => {
          close();
          refresh();
          toast.success("Collab posted", {
            description: `It's live in ${group.name}.`,
            action: {
              label: "View",
              onClick: () => navigate({ to: "/collab/$slug", params: { slug } }),
            },
          });
        }}
        onDraftSaved={() => {
          close();
          refresh();
          toast.success("Draft saved", {
            action: { label: "My Collabs", onClick: () => navigate({ to: "/me/collabs" }) },
          });
        }}
      />
    </Suspense>
  );

  return (
    <>
      {variant === "card" ? (
        <button
          type="button"
          onClick={start}
          className={
            "mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface/60 px-4 py-5 text-sm text-ink-muted transition hover:border-ink/30 hover:text-ink " +
            (className ?? "")
          }
        >
          <Plus className="h-4 w-4" />
          <span className="font-medium">{label}</span>
        </button>
      ) : (
        <Button size="sm" className={"rounded-md " + (className ?? "")} onClick={start}>
          <Plus className="h-4 w-4" /> {label}
        </Button>
      )}

      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="bottom"
            className="h-[92dvh] overflow-y-auto rounded-t-3xl border-border p-0"
          >
            <SheetTitle className="sr-only">{label}</SheetTitle>
            <div className="px-4">{composer}</div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto p-0">
            <DialogTitle className="sr-only">{label}</DialogTitle>
            <div className="px-6">{composer}</div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
