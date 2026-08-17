import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, ArrowDown, ArrowUp, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useEligibleSkillWorks, useSkillMutations, useSkills } from "@/hooks/use-skills";
import { MAX_SKILLS, SKILL_LABEL_MAX } from "@/lib/skills/normalize";
import type { EligibleWork, Skill } from "@/lib/skills/types";
import { fieldLabel } from "@/lib/taxonomy";
import { cn } from "@/lib/utils";

function workContext(w: { category_canonical: string | null; category: string | null; subtype: string | null }) {
  return [fieldLabel(w.category_canonical ?? w.category), w.subtype?.trim()]
    .filter(Boolean)
    .join(" · ");
}

function Thumb({ url, title }: { url: string | null; title: string }) {
  return (
    <div className="h-12 w-16 shrink-0 overflow-hidden rounded-md bg-surface-2">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-wide text-ink-muted">
          {title.slice(0, 3)}
        </div>
      )}
    </div>
  );
}

/**
 * Owner-side Skills editor. Every action persists immediately — it is
 * independent of the Edit profile save bar, like Influences.
 */
export function SkillsEditor({
  profileId,
  suggestions = [],
}: {
  profileId: string | undefined;
  suggestions?: string[];
}) {
  const { data: skills = [], isLoading } = useSkills(profileId);
  const { data: eligible = [], isLoading: worksLoading } = useEligibleSkillWorks(!!profileId);
  const m = useSkillMutations(profileId);
  const [editing, setEditing] = useState<Skill | null>(null);
  const [open, setOpen] = useState(false);

  const atCap = skills.length >= MAX_SKILLS;
  const noWorks = !worksLoading && eligible.length === 0;

  function move(index: number, dir: -1 | 1) {
    const next = [...skills];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    m.reorder.mutate(
      next.map((s) => s.id),
      { onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't reorder") },
    );
  }

  function openAdd() {
    setEditing(null);
    setOpen(true);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">
          {skills.length}/{MAX_SKILLS} added. Skills only appear on your profile once one links to a
          live public Work.
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1 rounded-md"
          disabled={atCap || noWorks}
          onClick={openAdd}
        >
          <Plus className="h-3.5 w-3.5" /> Add skill
        </Button>
      </div>

      {isLoading || worksLoading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : noWorks ? (
        <div className="rounded-xl border border-dashed border-border p-4">
          <p className="text-sm text-ink-soft">
            Post a Work before adding a skill. Skills on Workshop are demonstrated through the work
            itself.
          </p>
          <Button asChild size="sm" variant="ghost" className="mt-3 rounded-md">
            <Link to="/works/new">Post to Gallery</Link>
          </Button>
        </div>
      ) : skills.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Nothing yet. Add a skill and choose the Work that shows it.
        </p>
      ) : (
        <ul className="space-y-2">
          {skills.map((skill, i) => (
            <SkillRow
              key={skill.id}
              skill={skill}
              first={i === 0}
              last={i === skills.length - 1}
              onMove={(dir) => move(i, dir)}
              onEdit={() => {
                setEditing(skill);
                setOpen(true);
              }}
              onRemove={() =>
                m.remove.mutate(skill.id, {
                  onError: (e) => toast.error(e instanceof Error ? e.message : "Couldn't remove"),
                })
              }
            />
          ))}
        </ul>
      )}

      <SkillDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setEditing(null);
        }}
        editing={editing}
        works={eligible}
        suggestions={suggestions}
        busy={m.add.isPending || m.update.isPending}
        onSubmit={(label, workId) => {
          const onError = (e: unknown) =>
            toast.error(e instanceof Error ? e.message : "Couldn't save that skill");
          if (editing) {
            m.update.mutate(
              { id: editing.id, label, work_id: workId },
              {
                onSuccess: () => {
                  toast.success("Skill updated");
                  setOpen(false);
                  setEditing(null);
                },
                onError,
              },
            );
          } else {
            m.add.mutate(
              { label, work_id: workId },
              {
                onSuccess: () => {
                  toast.success("Skill added");
                  setOpen(false);
                },
                onError,
              },
            );
          }
        }}
      />
    </div>
  );
}

function SkillRow({
  skill,
  first,
  last,
  onMove,
  onEdit,
  onRemove,
}: {
  skill: Skill;
  first: boolean;
  last: boolean;
  onMove: (dir: -1 | 1) => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const work = skill.work;
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5">
      {work ? (
        <Thumb url={work.cover_url} title={work.title} />
      ) : (
        <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-muted">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{skill.label}</p>
        {work ? (
          <p className="truncate text-xs text-ink-muted">
            Demonstrated in <span className="text-ink-soft">{work.title}</span> · {workContext(work)}
          </p>
        ) : (
          <p className="truncate text-xs text-ink-muted">
            This Work is no longer public. Relink or remove this skill.
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="rounded-md text-xs"
          onClick={onEdit}
        >
          {work ? "Edit" : "Relink"}
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          disabled={first}
          aria-label={`Move ${skill.label} up`}
          onClick={() => onMove(-1)}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          disabled={last}
          aria-label={`Move ${skill.label} down`}
          onClick={() => onMove(1)}
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label={`Remove ${skill.label}`}
          onClick={onRemove}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}

function SkillDialog({
  open,
  onOpenChange,
  editing,
  works,
  suggestions,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Skill | null;
  works: EligibleWork[];
  suggestions: string[];
  busy: boolean;
  onSubmit: (label: string, workId: string) => void;
}) {
  const [label, setLabel] = useState("");
  const [workId, setWorkId] = useState<string | null>(null);
  const [term, setTerm] = useState("");
  const [seeded, setSeeded] = useState<string | null>(null);

  // Seed fields when the dialog opens for a given row (or for a fresh add).
  const seedKey = open ? (editing?.id ?? "new") : null;
  if (seedKey !== seeded) {
    setSeeded(seedKey);
    setLabel(editing?.label ?? "");
    setWorkId(editing?.work_id ?? null);
    setTerm("");
  }

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return works;
    return works.filter((w) => w.title.toLowerCase().includes(q));
  }, [term, works]);

  const chips = useMemo(
    () => suggestions.filter(Boolean).slice(0, 8),
    [suggestions],
  );

  const canSubmit = label.trim().length > 0 && !!workId && !busy;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit skill" : "Add skill"}</DialogTitle>
          <DialogDescription>
            Name the skill, then choose the Work that demonstrates it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="skill-label">Skill</Label>
            <Input
              id="skill-label"
              value={label}
              maxLength={SKILL_LABEL_MAX}
              placeholder="Editing"
              onChange={(e) => setLabel(e.target.value)}
            />
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {chips.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setLabel(s)}
                    className="rounded-full border border-border px-2.5 py-1 text-[11px] text-ink-soft transition hover:bg-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Demonstrated in</Label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted"
                aria-hidden="true"
              />
              <Input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search your works"
                className="pl-8"
                aria-label="Search your works"
              />
            </div>
            <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {filtered.length === 0 ? (
                <li className="px-1 py-2 text-sm text-ink-muted">No matching works.</li>
              ) : (
                filtered.map((w) => {
                  const selected = workId === w.id;
                  return (
                    <li key={w.id}>
                      <button
                        type="button"
                        onClick={() => setWorkId(w.id)}
                        aria-pressed={selected}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border p-2 text-left transition",
                          selected
                            ? "border-ink bg-muted"
                            : "border-border hover:bg-muted/60",
                        )}
                      >
                        <Thumb url={w.cover_url} title={w.title} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-ink">{w.title}</span>
                          <span className="block truncate text-xs text-ink-muted">
                            {workContext(w)}
                            {w.role_label ? ` · ${w.role_label}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" className="rounded-md" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-md"
              disabled={!canSubmit}
              onClick={() => onSubmit(label, workId!)}
            >
              {editing ? "Save skill" : "Add skill"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
