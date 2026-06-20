import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link as LinkIcon, X, Pencil, Check, Trash2, MoreVertical } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  getLineupForEvent, signUpForLineup, releaseMyLineupSpot, updateMyLineupNote, hostRemoveFromLineup,
} from "@/lib/lineup.functions";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { EventRsvpAuthSheet } from "@/components/event-rsvp-auth-sheet";

type Signup = {
  id: string;
  event_id: string;
  user_id: string;
  position: number;
  status: "confirmed" | "waitlist";
  note: string | null;
  created_at: string;
};

type Profile = { id: string; username: string | null; display_name: string | null; avatar_url: string | null };

const PENDING_KEY = "pendingLineupSignup";

export function LineupPanel({
  eventId,
  groupSlug,
  eventSlug,
  isHostOrAdmin,
}: {
  eventId: string;
  groupSlug: string;
  eventSlug: string;
  isHostOrAdmin: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const getFn = useServerFn(getLineupForEvent);
  const signUpFn = useServerFn(signUpForLineup);
  const releaseFn = useServerFn(releaseMyLineupSpot);
  const updateFn = useServerFn(updateMyLineupNote);
  const removeFn = useServerFn(hostRemoveFromLineup);

  const [noteDraft, setNoteDraft] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const { data } = useQuery({
    queryKey: ["lineup", eventId],
    queryFn: () => getFn({ data: { event_id: eventId } }),
    refetchInterval: 30_000,
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel(`lineup-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "event_lineup_signups", filter: `event_id=eq.${eventId}` }, () => {
        qc.invalidateQueries({ queryKey: ["lineup", eventId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [eventId, qc]);

  // Resume "I'm performing" tap after sign-in.
  useEffect(() => {
    if (!user) return;
    if (typeof window === "undefined") return;
    const marker = window.localStorage.getItem(PENDING_KEY);
    if (marker !== eventId) return;
    window.localStorage.removeItem(PENDING_KEY);
    (async () => {
      try {
        await signUpFn({ data: { event_id: eventId, note: null } });
        toast.success("You're on the list.");
        qc.invalidateQueries({ queryKey: ["lineup", eventId] });
      } catch (ex) {
        const msg = (ex as Error).message;
        if (!/already on this lineup/i.test(msg)) toast.error(msg);
      }
    })();
  }, [user, eventId, signUpFn, qc]);

  const signups = useMemo(() => (data?.signups ?? []) as Signup[], [data]);
  const profiles = (data?.profiles ?? {}) as Record<string, Profile>;
  const ev = data?.event as { lineup_capacity: number | null; starts_at: string } | undefined;

  const confirmed = signups.filter((s) => s.status === "confirmed");
  const waitlist = signups.filter((s) => s.status === "waitlist");
  const mine = user ? signups.find((s) => s.user_id === user.id) ?? null : null;
  const cap = ev?.lineup_capacity ?? null;

  async function handleSignUp() {
    if (!user) {
      if (typeof window !== "undefined") window.localStorage.setItem(PENDING_KEY, eventId);
      setAuthOpen(true);
      return;
    }
    try {
      await signUpFn({ data: { event_id: eventId, note: null } });
      toast.success(cap !== null && confirmed.length >= cap ? "You're on the waitlist." : "You're on the list.");
    } catch (ex) {
      toast.error((ex as Error).message);
    }
  }

  async function handleRelease() {
    if (!confirm("Drop your spot? The next person on the waitlist will be moved up.")) return;
    try { await releaseFn({ data: { event_id: eventId } }); toast.success("Spot released."); }
    catch (ex) { toast.error((ex as Error).message); }
  }

  async function saveNote() {
    try {
      await updateFn({ data: { event_id: eventId, note: noteDraft.trim() || null } });
      setEditing(false);
      toast.success("Saved.");
    } catch (ex) { toast.error((ex as Error).message); }
  }

  if (!ev) {
    return <div className="h-20 animate-pulse rounded-2xl bg-muted/30" />;
  }

  return (
    <div className="rounded-3xl border border-border bg-surface p-5 shadow-soft">
      <div className="mb-4 flex items-end justify-between gap-2">
        <div>
          <h3 className="font-display text-lg text-ink">Lineup</h3>
          <p className="text-xs text-ink-muted">
            {cap !== null ? `${confirmed.length} / ${cap} on the list` : `${confirmed.length} signed up`}
            {waitlist.length > 0 && ` · ${waitlist.length} on waitlist`}
            <span className="ml-1">· first come, first served</span>
          </p>
        </div>
        {!mine ? (
          <Button size="sm" className="rounded-full" onClick={handleSignUp}>
            I'm performing
          </Button>
        ) : (
          <Button size="sm" variant="ghost" className="rounded-full text-destructive" onClick={handleRelease}>
            <X className="mr-1 h-3.5 w-3.5" /> Drop my spot
          </Button>
        )}
      </div>

      {/* My note editor */}
      {mine && (
        <div className="mb-4 rounded-2xl border border-primary/30 bg-primary/5 p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              {mine.status === "waitlist" ? `Waitlist · #${waitlist.findIndex((s) => s.id === mine.id) + 1}` : `Your spot · #${confirmed.findIndex((s) => s.id === mine.id) + 1}`}
            </span>
            {!editing ? (
              <>
                <span className="text-ink-soft">
                  {mine.note ? <>doing <span className="font-medium text-ink">{mine.note}</span></> : <span className="text-ink-muted">add what you're doing (optional)</span>}
                </span>
                <Button size="sm" variant="ghost" className="ml-auto h-7 rounded-full" onClick={() => { setNoteDraft(mine.note ?? ""); setEditing(true); }}>
                  <Pencil className="mr-1 h-3 w-3" /> {mine.note ? "Edit" : "Add"}
                </Button>
              </>
            ) : (
              <div className="flex w-full items-center gap-2">
                <input
                  autoFocus
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  maxLength={80}
                  placeholder="e.g. 5 min standup, DJ set, instagram.com/me"
                />
                <Button size="sm" className="h-7 rounded-full" onClick={saveNote}><Check className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" className="h-7 rounded-full" onClick={() => setEditing(false)}><X className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* The list */}
      {signups.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border bg-background p-6 text-center text-sm text-ink-muted">
          Nobody's signed up yet. Be first.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-background">
          {confirmed.map((s, i) => (
            <SignupRow
              key={s.id}
              s={s}
              index={i + 1}
              profile={profiles[s.user_id] ?? null}
              isMe={!!user && s.user_id === user.id}
              isHostOrAdmin={isHostOrAdmin}
              onRemove={async () => {
                if (!confirm("Remove this performer from the lineup?")) return;
                try { await removeFn({ data: { event_id: eventId, signup_id: s.id } }); toast.success("Removed."); }
                catch (ex) { toast.error((ex as Error).message); }
              }}
            />
          ))}
          {waitlist.length > 0 && (
            <li className="px-4 py-2 text-[10px] font-medium uppercase tracking-wide text-ink-muted">
              Waitlist
            </li>
          )}
          {waitlist.map((s, i) => (
            <SignupRow
              key={s.id}
              s={s}
              index={i + 1}
              waitlist
              profile={profiles[s.user_id] ?? null}
              isMe={!!user && s.user_id === user.id}
              isHostOrAdmin={isHostOrAdmin}
              onRemove={async () => {
                if (!confirm("Remove this performer from the lineup?")) return;
                try { await removeFn({ data: { event_id: eventId, signup_id: s.id } }); toast.success("Removed."); }
                catch (ex) { toast.error((ex as Error).message); }
              }}
            />
          ))}
        </ul>
      )}

      <EventRsvpAuthSheet
        open={authOpen}
        onOpenChange={setAuthOpen}
        redirectTo={`/g/${groupSlug}/e/${eventSlug}`}
      />
    </div>
  );
}

function SignupRow({
  s, index, waitlist, profile, isMe, isHostOrAdmin, onRemove,
}: {
  s: Signup;
  index: number;
  waitlist?: boolean;
  profile: Profile | null;
  isMe: boolean;
  isHostOrAdmin: boolean;
  onRemove: () => void;
}) {
  const name = profile?.display_name || profile?.username || "Performer";
  const linkLike = s.note && /^https?:\/\//i.test(s.note);
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
        waitlist ? "border border-dashed border-border text-ink-muted" : "bg-primary text-primary-foreground",
      )}>
        {index}
      </div>
      {profile?.username ? (
        <Link to="/u/$username" params={{ username: profile.username }} className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <span className="truncate text-sm font-medium text-ink">{name}</span>
        </Link>
      ) : (
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={profile?.avatar_url ?? undefined} />
            <AvatarFallback>{name.slice(0, 1)}</AvatarFallback>
          </Avatar>
          <span className="truncate text-sm font-medium text-ink">{name}</span>
        </div>
      )}
      {s.note && (
        linkLike ? (
          <a href={s.note} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 truncate text-xs text-primary hover:underline">
            <LinkIcon className="h-3 w-3" /> link
          </a>
        ) : (
          <span className="min-w-0 flex-1 truncate text-xs text-ink-soft">· {s.note}</span>
        )
      )}
      {!s.note && <span className="min-w-0 flex-1" />}
      {isMe && <span className="text-[10px] text-primary">You</span>}
      {isHostOrAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Remove performer"><MoreVertical className="h-3.5 w-3.5" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onRemove} className="text-destructive">
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}
