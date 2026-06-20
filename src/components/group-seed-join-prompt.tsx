import { Link } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Sticky banner shown to logged-out visitors who landed via an admin
 * seed link (?j=<token>). After signup or sign-in they're auto-joined
 * to this group. See `src/lib/group-seed-links.functions.ts`.
 */
export function GroupSeedJoinPrompt({
  groupName,
  groupSlug,
  token,
}: {
  groupName: string;
  groupSlug: string;
  token: string;
}) {
  return (
    <div className="sticky top-0 z-30 -mx-4 mb-4 border-b border-primary/20 bg-primary/10 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm text-ink">
          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <span className="min-w-0 truncate">
            Create an account to join{" "}
            <span className="font-semibold">{groupName}</span> — it's free.
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button asChild size="sm" variant="ghost" className="rounded-full">
            <Link
              to="/login"
              search={{ join: token, group: groupSlug } as never}
            >
              Sign in
            </Link>
          </Button>
          <Button asChild size="sm" className="rounded-full">
            <Link
              to="/signup"
              search={{ join: token, group: groupSlug } as never}
            >
              Create account & join
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
