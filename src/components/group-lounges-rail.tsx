import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { listMyGroupLounges } from "@/lib/instant.functions";
import { formatRoomTitle } from "@/lib/instant";

/**
 * Horizontal rail of active Group audio rooms inside Groups the viewer has joined.
 * These were previously hidden on /lounge discovery; now they live on the Group page.
 */
export function GroupLoungesRail() {
  const { user } = useAuth();
  const listFn = useServerFn(listMyGroupLounges);

  const { data: lounges = [] } = useQuery({
    queryKey: ["my-group-lounges", user?.id ?? null],
    enabled: !!user,
    refetchInterval: 45_000,
    staleTime: 30_000,
    queryFn: () => listFn(),
  });

  if (!user || lounges.length === 0) return null;

  return (
    <section className="mt-4">
      <h2 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
        Live in your Groups
      </h2>
      <div className="flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {lounges.map((l) => (
          <Link
            key={l.roomId}
            to="/g/$slug"
            params={{ slug: l.groupSlug }}
            search={{ audio: "1" as const }}
            className="w-[240px] shrink-0 rounded-2xl border border-border/60 bg-surface p-3 transition hover:border-primary/40 hover:bg-muted/30"
          >
            <p className="truncate text-[11px] font-medium text-ink-muted">{l.groupName}</p>
            <p className="mt-0.5 truncate font-display text-sm text-ink">
              {formatRoomTitle(l.title, l.medium) || "Group audio"}
            </p>
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
              <span className="relative inline-flex h-1.5 w-1.5">
                {l.liveCount > 0 && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/60" />
                )}
                <span
                  className={
                    "relative inline-flex h-1.5 w-1.5 rounded-full " +
                    (l.liveCount > 0 ? "bg-primary" : "border border-ink/20")
                  }
                />
              </span>
              <Users className="h-3 w-3" /> {l.liveCount} here now
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
