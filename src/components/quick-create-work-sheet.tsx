import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PlusGate } from "@/components/plus-gate";
import { createQuickWork } from "@/lib/works-quick.functions";
import { WORK_LIMIT_ERROR } from "@/lib/works-quick.shared";
import { FIELD_OPTIONS, fieldLabel, formatSuggestionsFor, type FieldId } from "@/lib/taxonomy";
import { normalizeUrlOrKeep, normalizeUrl } from "@/lib/url-normalize";
import type { BlogEntityTag } from "@/lib/blog-entity-tags";

/**
 * Compact Work creation inside the Blog editor: title, category, format and an
 * optional link are enough to publish a legitimately linkable Work. Everything
 * else (cover, credits, description) stays in the full Work editor.
 */
export function QuickCreateWorkSheet({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (tag: BlogEntityTag) => void;
}) {
  const create = useServerFn(createQuickWork);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<FieldId>("visual_art");
  const [subtype, setSubtype] = useState<string>("");
  const [url, setUrl] = useState("");
  const [ownsRights, setOwnsRights] = useState(false);
  const [gate, setGate] = useState(false);

  function reset() {
    setTitle("");
    setCategory("visual_art");
    setSubtype("");
    setUrl("");
    setOwnsRights(false);
  }

  const mut = useMutation({
    mutationFn: async () => {
      const link = url.trim() ? normalizeUrlOrKeep(url.trim()) : null;
      if (link && !normalizeUrl(link)) throw new Error("That link doesn't look right.");
      return create({
        data: {
          title: title.trim(),
          category,
          subtype: subtype || null,
          primary_url: link,
        },
      });
    },
    onSuccess: (work) => {
      const w = work as { id: string; slug: string; title: string; category: string; subtype: string | null };
      onCreated({
        kind: "work",
        id: w.id,
        slug: w.slug,
        label: w.title,
        sublabel: w.subtype || (w.category ? fieldLabel(w.category) : null),
        image: null,
        work: {
          excerpt: null,
          categories: [w.category],
          subtype: w.subtype,
          cover_url: null,
          cover_aspect: null,
          cover_focal_x: null,
          cover_focal_y: null,
          credits: [],
        },
      });
      toast.success("Work published and connected");
      reset();
      onOpenChange(false);
    },
    onError: (e: Error) => {
      if (e.message?.includes(WORK_LIMIT_ERROR)) {
        onOpenChange(false);
        setGate(true);
        return;
      }
      toast.error(e.message || "Could not create that Work.");
    },
  });

  const subtypeOptions = formatSuggestionsFor([category]);
  const canSubmit = title.trim().length > 0 && ownsRights && !mut.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) mut.reset(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create a Work</DialogTitle>
            <DialogDescription>
              Publish a minimal Work now and connect it to this post. You can add a cover and details later.
            </DialogDescription>
          </DialogHeader>

          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) mut.mutate();
            }}
          >
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-ink-muted" htmlFor="qw-title">
                Title
              </label>
              <input
                id="qw-title"
                autoFocus
                value={title}
                maxLength={160}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="What is it called?"
                className="mt-1 h-11 w-full rounded-full border border-border bg-background px-4 text-[16px] text-ink focus:border-primary focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-ink-muted" htmlFor="qw-category">
                  Field
                </label>
                <select
                  id="qw-category"
                  value={category}
                  onChange={(e) => { setCategory(e.target.value as FieldId); setSubtype(""); }}
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-ink focus:border-primary focus:outline-none"
                >
                  {FIELD_OPTIONS.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider text-ink-muted" htmlFor="qw-subtype">
                  Format
                </label>
                <select
                  id="qw-subtype"
                  value={subtype}
                  onChange={(e) => setSubtype(e.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-ink focus:border-primary focus:outline-none"
                >
                  <option value="">Not sure yet</option>
                  {subtypeOptions.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-ink-muted">A hint for how this Work is presented.</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-ink-muted" htmlFor="qw-url">
                Link (optional)
              </label>
              <input
                id="qw-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="youtube.com/… , bandcamp, a PDF…"
                className="mt-1 h-11 w-full rounded-full border border-border bg-background px-4 text-[16px] text-ink focus:border-primary focus:outline-none"
              />
            </div>

            <label className="flex items-start gap-2 text-xs text-ink-soft">
              <Checkbox
                checked={ownsRights}
                onCheckedChange={(v) => setOwnsRights(v === true)}
                className="mt-0.5"
              />
              <span>This is my work, or I have the rights to share it.</span>
            </label>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!canSubmit}>
                {mut.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Publish and connect
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <PlusGate open={gate} onOpenChange={setGate} reason="work_limit" />
    </>
  );
}
