import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Calendar, MapPin, Users } from "lucide-react";
import { CategoryChip } from "./category-chip";
import type { Category } from "@/lib/categories";
import { cn } from "@/lib/utils";

export type WorkshopCardData = {
  id: string;
  title: string;
  slug: string;
  category: Category;
  prompt: string | null;
  starts_at: string | null;
  location_type: "online" | "in_person" | "hybrid";
  location_text: string | null;
  participant_cap: number | null;
  confirmed_count: number;
  application_count: number;
  status: string;
  audience_city_ids?: string[] | null;
  host?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
};

function whenText(starts: string | null) {
  if (!starts) return "Time TBD";
  const d = new Date(starts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const t = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `Today · ${t}`;
  if (isTomorrow) return `Tomorrow · ${t}`;
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + ` · ${t}`;
}

export function WorkshopCard({ ws, className }: { ws: WorkshopCardData; className?: string }) {
  const seats = ws.participant_cap ? `${ws.confirmed_count}/${ws.participant_cap}` : `${ws.confirmed_count}`;
  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3 }}
      className={cn("group relative flex flex-col overflow-hidden rounded-2xl bg-surface border border-border shadow-soft hover:shadow-lift transition-shadow", className)}
    >
      <Link to="/workshops/$slug" params={{ slug: ws.slug }} className="absolute inset-0 z-10" aria-label={ws.title} />
      <div className="flex items-center gap-2 p-4 pb-2">
        <CategoryChip category={ws.category} />
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-ink-soft">
          {ws.status}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
        <h3 className="font-display text-xl leading-tight text-ink line-clamp-2">{ws.title}</h3>
        {ws.prompt && <p className="text-sm text-ink-muted line-clamp-2">{ws.prompt}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-3 text-xs text-ink-soft">
          <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> {whenText(ws.starts_at)}</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {ws.location_type === "online" ? "Online" : ws.location_text || ws.location_type}</span>
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {seats}</span>
        </div>
        {ws.host && (
          <p className="text-xs text-ink-muted">
            Hosted by {ws.host.display_name || ws.host.username || "Anon"}
          </p>
        )}
      </div>
    </motion.article>
  );
}
