import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, Hammer, Megaphone, ListChecks, ArrowRight, AtSign, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  getInProgress,
  completeWorkshopTask,
  type InProgressTask,
  type InProgressWorkshop,
  type InProgressCollab,
} from "@/lib/in-progress.functions";

export const Route = createFileRoute("/in-progress")({
  component: InProgressPage,
  head: () => ({
    meta: [
      { title: "In Progress — Workshop" },
      { name: "description", content: "Tasks waiting on you, workshops you're in, and your open collabs — all in one place." },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl text-ink">Couldn't load In Progress.</h1>
        <p className="mt-2 text-sm text-ink-muted">{error.message}</p>
        <Button onClick={() => { reset(); router.invalidate(); }} className="mt-6 rounded-full">Try again</Button>
      </main>
    );
  },
  notFoundComponent: () => <main className="px-4 py-20 text-center text-ink-muted">Not found.</main>,
});

function InProgressPage() {
  const { user, loading } = useAuth();
  const fn = useServerFn(getInProgress);
  const { data, isLoading } = useQuery({
    queryKey: ["in-progress", user?.id ?? null],
    queryFn: () => fn({ data: {} }),
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  if (loading) return null;

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="font-display text-3xl text-ink">Sign in to see what's on your plate.</h1>
        <p className="mt-2 text-sm text-ink-muted">Tasks, workshops, and collabs — yours, in one view.</p>
        <Link to="/auth" className="mt-6 inline-block">
          <Button className="rounded-full">Sign in</Button>
        </Link>
      </main>
    );
  }

  const tasks = data?.tasks ?? [];
  const workshops = data?.workshops ?? [];
  const collabs = data?.collabs ?? [];
  const totalCount = tasks.length + workshops.length + collabs.length;

  return (
    <main className="mx-auto max-w-4xl px-4 pb-20 pt-10 md:px-6 md:pt-14">
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-ink-soft shadow-soft">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
          </span>
          Daily dashboard
        </div>
        <h1 className="mt-3 font-display text-4xl text-ink md:text-5xl">In Progress</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Tasks waiting on you, the workshops you're in, and your open collabs.
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-2" />
          ))}
        </div>
      ) : (
        <div className="space-y-10">
          <TasksSection tasks={tasks} />
          <WorkshopsSection workshops={workshops} />
          <CollabsSection collabs={collabs} />
          {totalCount === 0 && (
            <p className="text-center text-xs text-ink-muted">
              All clear across the board. Anything you start will show up here.
            </p>
          )}
        </div>
      )}
    </main>
  );
}

function SectionHeader({ icon, title, count, hint }: { icon: React.ReactNode; title: string; count: number; hint?: string }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="inline-flex items-center gap-2 font-display text-xl text-ink md:text-2xl">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</span>
          {title}
          <span className="ml-1 inline-flex items-center justify-center rounded-full bg-muted px-2 text-xs font-medium text-ink-soft">{count}</span>
        </h2>
        {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      </div>
    </div>
  );
}

function TasksSection({ tasks }: { tasks: InProgressTask[] }) {
  return (
    <section>
      <SectionHeader
        icon={<ListChecks className="h-4 w-4" />}
        title="Tasks for you"
        count={tasks.length}
        hint="Assigned to you or @-mentioned in a Workshop."
      />
      {tasks.length === 0 ? (
        <SectionEmpty
          message="No tasks waiting on you."
          actionLabel="Join a Workshop"
          actionTo="/workshop"
        />
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => <TaskRow key={t.id} task={t} />)}
        </ul>
      )}
    </section>
  );
}

function TaskRow({ task }: { task: InProgressTask }) {
  const qc = useQueryClient();
  const fn = useServerFn(completeWorkshopTask);
  const done = useMutation({
    mutationFn: () => fn({ data: { task_id: task.id } }),
    onSuccess: () => {
      toast.success("Marked done");
      qc.invalidateQueries({ queryKey: ["in-progress"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const due = task.due_by ? new Date(task.due_by) : null;
  const overdue = !!due && due.getTime() < Date.now();

  return (
    <li className="group flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft transition hover:border-ink/15">
      <button
        onClick={() => done.mutate()}
        disabled={done.isPending}
        className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-transparent transition hover:border-primary hover:text-primary disabled:opacity-50"
        aria-label="Mark done"
      >
        <CheckCircle2 className="h-4 w-4" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/workshops/$slug"
            params={{ slug: task.workshop_slug }}
            className="text-[11px] uppercase tracking-wide text-ink-muted hover:text-ink"
          >
            {task.workshop_title}
          </Link>
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-ink-soft">
            {task.reason === "assigned" ? <UserCheck className="h-3 w-3" /> : <AtSign className="h-3 w-3" />}
            {task.reason === "assigned" ? "Assigned" : "Mentioned"}
          </span>
          {due && (
            <span className={`inline-flex items-center gap-1 text-[11px] ${overdue ? "text-destructive" : "text-ink-muted"}`}>
              <Clock className="h-3 w-3" />
              {due.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              {overdue && " · overdue"}
            </span>
          )}
        </div>
        <div className="mt-0.5 line-clamp-2 text-sm font-medium text-ink">{task.title}</div>
        {task.body && <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{task.body}</p>}
      </div>
    </li>
  );
}

function WorkshopsSection({ workshops }: { workshops: InProgressWorkshop[] }) {
  return (
    <section>
      <SectionHeader
        icon={<Hammer className="h-4 w-4" />}
        title="Workshops you're in"
        count={workshops.length}
        hint="Active studios you're confirmed in."
      />
      {workshops.length === 0 ? (
        <SectionEmpty
          message="You're not in an active Workshop right now."
          actionLabel="Drop into a Workshop"
          actionTo="/workshop"
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {workshops.map((w) => (
            <li key={w.id}>
              <Link
                to="/workshops/$slug"
                params={{ slug: w.slug }}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-ink-muted">{w.status}</div>
                  <div className="line-clamp-1 font-display text-base text-ink">{w.title}</div>
                  <div className="mt-0.5 text-[11px] text-ink-muted">
                    Last activity {new Date(w.last_activity_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CollabsSection({ collabs }: { collabs: InProgressCollab[] }) {
  return (
    <section>
      <SectionHeader
        icon={<Megaphone className="h-4 w-4" />}
        title="Your open Collabs"
        count={collabs.length}
        hint="Posts you authored that are still accepting people."
      />
      {collabs.length === 0 ? (
        <SectionEmpty
          message="No open Collabs from you right now."
          actionLabel="Post a Collab"
          actionTo="/collab/new"
          secondaryLabel="Browse open calls"
          secondaryTo="/collab"
        />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {collabs.map((c) => (
            <li key={c.id}>
              <Link
                to="/collab/$slug"
                params={{ slug: c.slug }}
                className="group flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-ink-muted">{c.status}</div>
                  <div className="line-clamp-1 font-display text-base text-ink">{c.title}</div>
                  <div className="mt-0.5 text-[11px] text-ink-muted">
                    Posted {new Date(c.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-ink-muted transition group-hover:translate-x-0.5 group-hover:text-ink" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SectionEmpty({
  message,
  actionLabel,
  actionTo,
  secondaryLabel,
  secondaryTo,
}: {
  message: string;
  actionLabel: string;
  actionTo: string;
  secondaryLabel?: string;
  secondaryTo?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-surface/60 p-5 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-ink-muted">{message}</p>
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        <Link to={actionTo}>
          <Button size="sm" className="rounded-full">{actionLabel}</Button>
        </Link>
        {secondaryLabel && secondaryTo && (
          <Link to={secondaryTo}>
            <Button size="sm" variant="outline" className="rounded-full">{secondaryLabel}</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
