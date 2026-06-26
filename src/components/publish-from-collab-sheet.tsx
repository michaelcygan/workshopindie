import { useState, useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Sparkles, Check, ChevronRight, UserCircle2, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/image-upload";
import { listApplicants } from "@/lib/collab.functions";
import { publishWorkFromCollab } from "@/lib/collab-publish.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  postTitle: string;
  postDescription: string | null;
};

type Step = 1 | 2 | 3;

export function PublishFromCollabSheet({ open, onOpenChange, postId, postTitle, postDescription }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchApplicants = useServerFn(listApplicants);
  const publishFn = useServerFn(publishWorkFromCollab);

  const [step, setStep] = useState<Step>(1);
  const [title, setTitle] = useState(postTitle);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [description, setDescription] = useState(postDescription ?? "");
  const [primaryUrl, setPrimaryUrl] = useState("");
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<{ name: string }[]>([]);
  const [newExtra, setNewExtra] = useState("");

  const { data: applicants } = useQuery({
    queryKey: ["collab-applicants", postId],
    queryFn: () => fetchApplicants({ data: { collabPostId: postId } }),
    enabled: open,
  });

  // Members who actually applied (have a contact event) — these are the
  // pre-checked credit candidates. We dedupe by sender_user_id.
  const candidates = useMemo(() => {
    const map = new Map<string, { id: string; display_name: string | null; username: string | null; avatar_url: string | null; headline: string | null }>();
    for (const m of applicants?.members ?? []) {
      if (m.sender && !map.has(m.sender.id)) map.set(m.sender.id, m.sender);
    }
    return Array.from(map.values());
  }, [applicants]);

  const publish = useMutation({
    mutationFn: async () => {
      const creditedUserIds = candidates.filter((c) => !unchecked.has(c.id)).map((c) => c.id);
      return publishFn({
        data: {
          collabPostId: postId,
          title: title.trim(),
          description: description.trim() || undefined,
          coverUrl: coverUrl || undefined,
          primaryUrl: primaryUrl.trim() || undefined,
          creditedUserIds,
          extraCredits: extras,
        },
      });
    },
    onSuccess: (res) => {
      toast.success("Work published — credits sent to your collaborators");
      qc.invalidateQueries({ queryKey: ["collab", postId] });
      onOpenChange(false);
      navigate({ to: "/works/$slug", params: { slug: res.workSlug } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function next() {
    if (step === 1 && !title.trim()) return toast.error("Add a title to continue");
    setStep((s) => (s === 3 ? 3 : ((s + 1) as Step)));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) setStep(1); onOpenChange(o); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display text-2xl">
            <Sparkles className="h-5 w-5 text-primary" /> Publish the Work
          </DialogTitle>
          <p className="text-sm text-ink-muted">Three taps. The collab becomes a finished thing on your profile and your collaborators get the credit.</p>
        </DialogHeader>

        {/* Stepper */}
        <div className="mt-1 flex items-center gap-2 text-xs text-ink-muted">
          {([1, 2, 3] as Step[]).map((s) => (
            <div key={s} className={cn("flex items-center gap-2", s !== 3 && "flex-1")}>
              <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                step >= s ? "bg-ink text-background" : "bg-muted text-ink-soft")}>{s}</span>
              <span className={cn(step === s && "text-ink")}>{s === 1 ? "Cover & title" : s === 2 ? "Credits" : "Publish"}</span>
              {s !== 3 && <span className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        <motion.div key={step} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-4">
          {step === 1 && (
            <>
              <ImageUpload value={coverUrl} onChange={setCoverUrl} bucket="work-covers" aspect="portrait" label="Drop a cover (optional — we'll use a gradient if not)" />
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-soft">Title</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={140} placeholder="What is it called?" />
              </div>
              <details className="rounded-xl border border-border bg-surface p-3 text-sm">
                <summary className="cursor-pointer text-ink-soft">Edit description or add a link</summary>
                <div className="mt-3 space-y-3">
                  <Textarea rows={4} maxLength={3000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What did you make? Who's it for?" />
                  <Input type="url" value={primaryUrl} onChange={(e) => setPrimaryUrl(e.target.value)} placeholder="https://… (Vimeo, Bandcamp, your site)" />
                </div>
              </details>
            </>
          )}

          {step === 2 && (
            <>
              <p className="text-sm text-ink-muted">Everyone who applied is pre-credited. Uncheck anyone who didn't end up on the project. Add people not on Workshop by name.</p>

              {candidates.length === 0 && extras.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-ink-muted">
                  No applicants to credit yet. You can add collaborators by name below, or skip — you'll be the sole credit.
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
                  {candidates.map((c) => {
                    const checked = !unchecked.has(c.id);
                    const name = c.display_name || c.username || "Member";
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => setUnchecked((prev) => {
                            const next = new Set(prev);
                            if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                            return next;
                          })}
                          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
                        >
                          <span className={cn("flex h-5 w-5 items-center justify-center rounded-md border", checked ? "border-ink bg-ink text-background" : "border-border bg-surface")}>
                            {checked && <Check className="h-3 w-3" />}
                          </span>
                          <div className="h-8 w-8 overflow-hidden rounded-full bg-muted">
                            {c.avatar_url ? <img src={c.avatar_url} className="h-full w-full object-cover" alt="" /> : <UserCircle2 className="h-full w-full text-ink-muted" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-ink">{name}</div>
                            {c.headline && <div className="truncate text-xs text-ink-muted">{c.headline}</div>}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                  {extras.map((e, i) => (
                    <li key={`x-${i}`} className="flex items-center gap-3 px-4 py-3">
                      <span className="flex h-5 w-5 items-center justify-center rounded-md border border-ink bg-ink text-background"><Check className="h-3 w-3" /></span>
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-ink-soft text-xs">{e.name[0]?.toUpperCase()}</span>
                      <div className="min-w-0 flex-1"><div className="truncate text-sm text-ink">{e.name}</div><div className="text-xs text-ink-muted">Guest credit</div></div>
                      <button type="button" onClick={() => setExtras((p) => p.filter((_, idx) => idx !== i))} className="text-ink-muted hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder="Add someone by name (optional)"
                  value={newExtra}
                  onChange={(e) => setNewExtra(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newExtra.trim()) {
                      e.preventDefault();
                      setExtras((p) => [...p, { name: newExtra.trim() }]);
                      setNewExtra("");
                    }
                  }}
                  maxLength={80}
                />
                <Button type="button" variant="outline" className="rounded-full gap-1" disabled={!newExtra.trim()}
                  onClick={() => { setExtras((p) => [...p, { name: newExtra.trim() }]); setNewExtra(""); }}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            </>
          )}

          {step === 3 && (
            <div className="rounded-2xl border border-border bg-surface p-5">
              <div className="flex gap-4">
                {coverUrl ? (
                  <img src={coverUrl} alt="" className="h-24 w-20 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="h-24 w-20 shrink-0 rounded-xl gradient-motion" />
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-xl text-ink line-clamp-2">{title}</h3>
                  <p className="mt-1 text-xs text-ink-muted">
                    {1 + candidates.filter((c) => !unchecked.has(c.id)).length + extras.length} credits ·
                    {" "}links back to this collab
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm text-ink-muted">
                Tapping Publish closes this collab, posts the Work to your profile, and notifies every credited collaborator.
              </p>
            </div>
          )}
        </motion.div>

        <DialogFooter className="mt-4 gap-2">
          {step > 1 && (
            <Button variant="ghost" className="rounded-full" onClick={() => setStep((s) => (s - 1) as Step)}>Back</Button>
          )}
          <div className="flex-1" />
          {step < 3 ? (
            <Button className="rounded-full gap-1" onClick={next}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button className="rounded-full gap-1" disabled={publish.isPending} onClick={() => publish.mutate()}>
              <Sparkles className="h-4 w-4" /> {publish.isPending ? "Publishing…" : "Publish Work"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
