import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Clock, MapPin, Users, DollarSign } from "lucide-react";
import { CategoryChip } from "./category-chip";
import type { Category } from "@/lib/categories";
import { cn } from "@/lib/utils";

export type CollabCardData = {
  id: string;
  title: string;
  slug: string;
  category: Category;
  description: string | null;
  timeline_text: string | null;
  location_mode: "online" | "in_person" | "hybrid";
  compensation_type: "paid" | "unpaid" | "credit" | "negotiable" | "unspecified";
  status: string;
  created_at: string;
  user?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
  city?: { name: string } | null;
  roles_count?: { count: number }[] | null;
};

const COMP_LABEL: Record<CollabCardData["compensation_type"], string> = {
  paid: "Paid",
  unpaid: "Unpaid",
  credit: "Credit",
  negotiable: "Negotiable",
  unspecified: "Comp TBD",
};

export function CollabCard({ post, className }: { post: CollabCardData; className?: string }) {
  const rolesCount = post.roles_count?.[0]?.count ?? 0;
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className={cn("group relative flex flex-col overflow-hidden rounded-2xl bg-surface border border-border shadow-soft hover:shadow-lift transition-shadow", className)}
    >
      <Link to="/collab/$slug" params={{ slug: post.slug }} className="absolute inset-0 z-10" aria-label={post.title} />
      <div className="flex items-center gap-2 p-4 pb-2">
        <CategoryChip category={post.category} />
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-ink-soft">
          {post.status}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
        <h3 className="font-display text-xl leading-tight text-ink line-clamp-2">{post.title}</h3>
        {post.description && <p className="text-sm text-ink-muted line-clamp-3">{post.description}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-3 text-xs text-ink-soft">
          {rolesCount > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {rolesCount} role{rolesCount === 1 ? "" : "s"}</span>}
          <span className="inline-flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" /> {COMP_LABEL[post.compensation_type]}</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {post.location_mode === "online" ? "Online" : post.city?.name || post.location_mode}</span>
          {post.timeline_text && <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {post.timeline_text}</span>}
        </div>
        {post.user && (
          <p className="text-xs text-ink-muted">
            Posted by {post.user.display_name || post.user.username || "Anon"}
          </p>
        )}
      </div>
    </motion.article>
  );
}
