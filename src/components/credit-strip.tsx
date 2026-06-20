import { Link } from "@tanstack/react-router";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ProfilePeek } from "@/components/profile-peek";
import { cn } from "@/lib/utils";

export type CreditChip = {
  id: string;
  role_label: string;
  display_name?: string | null;
  profiles: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
};

/**
 * Cast-strip view of credits. Dense, scannable, every chip links to a
 * profile when we have one. Plain-name credits (no platform account) render
 * as a static chip — they still appear in the cast strip, just no link.
 */
export function CreditStrip({ credits, className }: { credits: CreditChip[]; className?: string }) {
  if (credits.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {credits.map((c) => {
        const p = c.profiles;
        const name = p?.display_name || p?.username || c.display_name || "Anon";
        const chip = (
          <span className="group inline-flex items-center gap-2 rounded-full border border-border bg-surface px-2 py-1 text-sm text-ink transition hover:shadow-soft hover:border-ink/20">
            <Avatar className="h-6 w-6">
              <AvatarImage src={p?.avatar_url ?? undefined} />
              <AvatarFallback className="text-[10px]">{name[0]}</AvatarFallback>
            </Avatar>
            <span className="font-medium leading-none">{name}</span>
            <span className="text-xs text-ink-muted leading-none">· {c.role_label}</span>
          </span>
        );
        if (p?.username) {
          return (
            <Link key={c.id} to="/u/$username" params={{ username: p.username }} className="no-underline">
              {chip}
            </Link>
          );
        }
        if (p?.id) {
          return (
            <ProfilePeek key={c.id} userId={p.id}>
              <button type="button" className="cursor-pointer">{chip}</button>
            </ProfilePeek>
          );
        }
        return <span key={c.id}>{chip}</span>;
      })}
    </div>
  );
}
