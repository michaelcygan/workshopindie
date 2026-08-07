import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, PenLine, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createMyBlogDraft } from "@/lib/blog-member.functions";
import type { HomeContinueAction, HomeMineItem } from "@/lib/home-types";

function Cover({
  url,
  focalX,
  focalY,
  title,
}: {
  url: string | null;
  focalX?: number | null;
  focalY?: number | null;
  title: string;
}) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        loading="lazy"
        style={
          // Focal points are stored as percentages (0-100), not fractions.
          focalX != null || focalY != null
            ? { objectPosition: `${focalX ?? 50}% ${focalY ?? 50}%` }
            : undefined
        }

        className="aspect-[16/10] w-full object-cover transition duration-500 group-hover:scale-[1.03]"
      />
    );
  }
  return (
    <div className="flex aspect-[16/10] w-full items-end bg-secondary p-3 opacity-80">
      <span className="line-clamp-2 font-display text-sm leading-snug text-ink/80">{title}</span>
    </div>
  );
}

function MineCard({ item }: { item: HomeMineItem }) {
  return (
    <Link
      to={item.to as never}
      params={item.params as never}
      className="group flex w-[70vw] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-border bg-surface transition hover:border-ink/20 hover:shadow-soft sm:w-auto"
    >
      <Cover url={item.coverUrl} focalX={item.focalX} focalY={item.focalY} title={item.title} />
      <div className="flex flex-1 flex-col gap-1 p-3.5">
        <span className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">{item.label}</span>
        <span className="line-clamp-2 font-display text-[15px] leading-snug text-ink group-hover:underline">
          {item.title}
        </span>
        {item.subtitle && (
          <span className="line-clamp-2 text-xs text-ink-soft">{item.subtitle}</span>
        )}
      </div>
    </Link>
  );
}

/** Compact "Keep going" chip-cards — the old Continue making actions. */
function KeepGoingCard({ action }: { action: HomeContinueAction }) {
  const navigate = useNavigate();
  const createFn = useServerFn(createMyBlogDraft);
  const createMut = useMutation({
    mutationFn: () => createFn({ data: { seedTag: { kind: "work", id: action.workId! } } }),
    onSuccess: (res: { id: string }) => navigate({ to: "/me/blog/$id", params: { id: res.id } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const body = (
    <>
      {action.coverUrl ? (
        <img
          src={action.coverUrl}
          alt=""
          loading="lazy"
          className="h-12 w-12 shrink-0 rounded-xl object-cover"
        />
      ) : (
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-border text-[10px] uppercase tracking-widest text-ink-muted">
          {action.actionLabel.slice(0, 1)}
        </span>
      )}
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate font-display text-[14px] leading-snug text-ink">
          {action.title}
        </span>
        {action.detail && (
          <span className="block truncate text-xs text-ink-soft">{action.detail}</span>
        )}
        <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-ink-muted group-hover:text-ink">
          {action.actionLabel} <ArrowRight className="h-3 w-3" />
        </span>
      </span>
    </>
  );

  const cls =
    "group flex min-h-[64px] w-[78vw] shrink-0 snap-start items-center gap-3 rounded-2xl border border-border bg-surface p-2.5 transition hover:border-ink/20 sm:w-auto";

  if (action.kind === "work_needs_story") {
    return (
      <button
        type="button"
        className={cls}
        disabled={createMut.isPending}
        onClick={() => createMut.mutate()}
      >
        {createMut.isPending ? (
          <span className="px-2 text-sm text-ink-soft">Starting your draft…</span>
        ) : (
          body
        )}
      </button>
    );
  }

  return (
    <Link to={action.to as never} params={(action.params ?? {}) as never} className={cls}>
      {body}
    </Link>
  );
}

export function YourWorkshop({
  mine,
  actions,
}: {
  mine: HomeMineItem[];
  actions: HomeContinueAction[];
}) {
  return (
    <div className="space-y-4">
      {mine.length > 0 ? (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
          {mine.map((item) => (
            <MineCard key={`${item.kind}:${item.id}`} item={item} />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border bg-surface-2/40 px-4 py-3.5">
          <p className="min-w-0 flex-1 text-sm text-ink-soft">
            Nothing published yet — start with one thing.
          </p>
          <Button asChild size="sm" className="rounded-md gap-1.5">
            <Link to="/works/new">
              <Sparkles className="h-3.5 w-3.5" /> Post a Work
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="rounded-md gap-1.5">
            <Link to="/me/blog">
              <PenLine className="h-3.5 w-3.5" /> Write a story
            </Link>
          </Button>
        </div>
      )}

      {actions.length > 0 && (
        <div>
          <div className="mb-1.5 text-[10px] uppercase tracking-[0.12em] text-ink-muted">
            Keep going
          </div>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
            {actions.map((a) => (
              <KeepGoingCard key={`${a.kind}:${a.title}`} action={a} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
