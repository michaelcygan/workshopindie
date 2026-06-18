import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Clock, Radio } from "lucide-react";
import { CategoryChip } from "./category-chip";
import { StateBadge } from "./state-badge";
import type { Category } from "@/lib/categories";
import { timelineBadgeText, type TimelineMode } from "./timeline-picker";
import { cn } from "@/lib/utils";
import { VouchRow, type VouchersByPost } from "./vouch-button";
import { BoostButton } from "./boost-button";
import { InlineGroupChips } from "./inline-group-chips";
import type { GroupTag } from "@/hooks/use-group-tags";

export type CollabCardData = {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  category: Category;
  description: string | null;
  timeline_text: string | null;
  timeline_mode?: TimelineMode | null;
  starts_on?: string | null;
  ends_on?: string | null;
  location_mode: "online" | "in_person" | "hybrid";
  compensation_type: "paid" | "unpaid" | "credit" | "negotiable" | "unspecified";
  status: string;
  created_at: string;
  live_workshop_id?: string | null;
  resulting_work_id?: string | null;
  vouch_count?: number | null;
  boost_count?: number | null;
  user?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
  city?: { name: string } | null;
  roles?: { id: string; role_name: string; sort_order: number }[] | null;
};

const COMP_LABEL: Record<CollabCardData["compensation_type"], string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  credit: "Credit",
  negotiable: "Negotiable",
  unspecified: "Comp TBD",
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const s = Math.max(1, Math.floor(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

function locationLabel(post: CollabCardData): string {
  if (post.location_mode === "online") return "Online";
  if (post.location_mode === "hybrid") return post.city?.name ? `Hybrid · ${post.city.name}` : "Hybrid";
  return post.city?.name || "In person";
}

export function CollabCard({
  post,
  vouchers,
  boosted,
  groups,
  myGroupIds,
  className,
}: {
  post: CollabCardData;
  vouchers?: VouchersByPost;
  boosted?: boolean;
  groups?: GroupTag[];
  myGroupIds?: Set<string>;
  className?: string;
}) {
  const roles = (post.roles ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const shownRoles = roles.slice(0, 2);
  const overflow = Math.max(0, roles.length - shownRoles.length);
  const author = post.user?.display_name || post.user?.username || "Anon";
  const initial = author.trim().charAt(0).toUpperCase() || "·";
  const tlBadge = post.timeline_mode
    ? timelineBadgeText(post.timeline_mode, post.starts_on ?? null, post.ends_on ?? null)
    : null;
  const tlLabel = tlBadge ?? post.timeline_text;
  const postVouchers = vouchers?.get(post.id) ?? [];
  const vouchCount = post.vouch_count ?? postVouchers.length;
  const isLive = !!post.live_workshop_id;
  const isShipped = post.status === "closed" && !!post.resulting_work_id;
  const daysToDeadline = post.ends_on
    ? Math.ceil((new Date(post.ends_on).getTime() - Date.now()) / 86400000)
    : null;
  const closingSoon = post.status === "open" && daysToDeadline !== null && daysToDeadline >= 0 && daysToDeadline <= 7;

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl border bg-surface shadow-soft transition-shadow hover:shadow-lift",
        boosted ? "border-primary/40 ring-1 ring-primary/20" : "border-border",
        isLive && "ring-1 ring-primary/30",
        className,
      )}
    >
      <Link
        to="/collab/$slug"
        params={{ slug: post.slug }}
        className="absolute inset-0 z-10"
        aria-label={post.title}
      />

      <div className="flex items-center gap-2 px-5 pt-5">
        <CategoryChip category={post.category} />
        {post.status === "open" ? (
          <StateBadge tone="open" label="Open" sublabel={closingSoon ? "Closing soon" : "Casting"} />
        ) : isShipped ? (
          <StateBadge tone="closed" label="Closed" sublabel="Shipped" />
        ) : null}
        {isLive && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary-foreground" />
            </span>
            <Radio className="h-3 w-3" /> Live
          </span>
        )}
        {boosted && (
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            Boosted
          </span>
        )}
        <span className="ml-auto text-[11px] text-ink-muted">{relativeTime(post.created_at)}</span>
      </div>


      <div className="flex flex-1 flex-col gap-3 px-5 pb-5 pt-3">
        <h3 className="font-display text-[22px] leading-[1.15] text-ink line-clamp-2 transition-colors group-hover:text-gradient-motion">
          {post.title}
        </h3>
        <InlineGroupChips groups={groups} myGroupIds={myGroupIds} />
        {post.description && (
          <p className="text-sm leading-relaxed text-ink-muted line-clamp-3">{post.description}</p>
        )}

        {shownRoles.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {shownRoles.map((r) => (
              <span
                key={r.id}
                className="inline-flex items-center rounded-full border border-border bg-surface-2/60 px-2.5 py-0.5 text-xs text-ink"
              >
                {r.role_name}
              </span>
            ))}
            {overflow > 0 && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs text-ink-muted">
                +{overflow} more
              </span>
            )}
          </div>
        )}

        {tlLabel && (
          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
            <Clock className="h-3 w-3" />
            <span className="truncate">{tlLabel}</span>
          </div>
        )}

        <VouchRow
          postId={post.id}
          authorId={post.user_id}
          vouchCount={vouchCount}
          vouchers={postVouchers}
          className="pt-1"
        />

        <div className="mt-auto flex items-center gap-2 border-t border-border/60 pt-3 text-xs text-ink-soft">
          {post.user?.avatar_url ? (
            <img
              src={post.user.avatar_url}
              alt=""
              className="h-6 w-6 rounded-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-ink-soft">
              {initial}
            </span>
          )}
          <span className="truncate font-medium text-ink">{author}</span>
          <span className="text-ink-muted/60">·</span>
          <span className="truncate">{locationLabel(post)}</span>
          <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-ink-soft">
            {COMP_LABEL[post.compensation_type]}
          </span>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <BoostButton postId={post.id} authorId={post.user_id} />
        </div>
      </div>
    </motion.article>
  );
}
