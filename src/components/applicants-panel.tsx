import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Mail,
  Phone,
  ExternalLink,
  Instagram,
  Check,
  Undo2,
  Inbox,
  UserCircle2,
  MessageCircle,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  acceptCollabApplicant,
  listApplicants,
  setApplicationReviewStatus,
  updateGuestApplicationStatus,
} from "@/lib/collab.functions";
import type { CollabReviewStatus } from "@/lib/collab/lifecycle";
import { toast } from "sonner";

type Props = { postId: string };

type Tab = "team" | "applicants" | "pitches" | "declined";

const TABS: { key: Tab; label: string }[] = [
  { key: "team", label: "Team" },
  { key: "applicants", label: "Applicants" },
  { key: "pitches", label: "Suggestions" },
  { key: "declined", label: "Declined" },
];

/** Lets other parts of the Collab page jump straight to a tab in this panel. */
export const COLLAB_PANEL_TAB_EVENT = "collab:focus-applicants-tab";

export function focusCollabPanelTab(tab: Tab) {
  document.getElementById("applicants")?.scrollIntoView({ behavior: "smooth", block: "start" });
  window.dispatchEvent(new CustomEvent(COLLAB_PANEL_TAB_EVENT, { detail: tab }));
}


const isDeclined = (s: CollabReviewStatus) => s === "declined" || s === "spam" || s === "withdrawn";

export function ApplicantsPanel({ postId }: Props) {
  const fetchApplicants = useServerFn(listApplicants);
  const updateStatus = useServerFn(updateGuestApplicationStatus);
  const reviewFn = useServerFn(setApplicationReviewStatus);
  const acceptFn = useServerFn(acceptCollabApplicant);
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("applicants");
  const [tabTouched, setTabTouched] = useState(false);

  useEffect(() => {
    const onFocus = (e: Event) => {
      const next = (e as CustomEvent<Tab>).detail;
      if (next) {
        setTab(next);
        setTabTouched(true);
      }
    };
    window.addEventListener(COLLAB_PANEL_TAB_EVENT, onFocus);
    return () => window.removeEventListener(COLLAB_PANEL_TAB_EVENT, onFocus);
  }, []);


  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["collab-applicants", postId] });
    qc.invalidateQueries({ queryKey: ["collab-members", postId] });
  };

  const accept = useMutation({
    mutationFn: (vars: { applicantUserId: string; contactEventId: string | null }) =>
      acceptFn({
        data: {
          collabPostId: postId,
          applicantUserId: vars.applicantUserId,
          contactEventId: vars.contactEventId,
        },
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Accepted — they can now join the workspace.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewMember = useMutation({
    mutationFn: (vars: { contactEventId: string; reviewStatus: CollabReviewStatus }) =>
      reviewFn({ data: { collabPostId: postId, ...vars } }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const reviewGuest = useMutation({
    mutationFn: (vars: { id: string; reviewStatus: CollabReviewStatus }) =>
      updateStatus({ data: vars }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["collab-applicants", postId],
    queryFn: () => fetchApplicants({ data: { collabPostId: postId } }),
  });

  const members = useMemo(() => data?.members ?? [], [data]);
  const guests = useMemo(() => data?.guests ?? [], [data]);

  const buckets = useMemo(() => {
    const team = members.filter((m) => m.accepted);
    const activeMembers = members.filter((m) => !m.accepted && !isDeclined(m.review_status));
    const activeGuests = guests.filter((g) => !isDeclined(g.review_status));
    return {
      team,
      applicants: {
        members: activeMembers.filter((m) => m.application_kind === "role"),
        guests: activeGuests.filter((g) => g.application_kind === "role"),
      },
      pitches: {
        members: activeMembers.filter((m) => m.application_kind !== "role"),
        guests: activeGuests.filter((g) => g.application_kind !== "role"),
      },
      declined: {
        members: members.filter((m) => !m.accepted && isDeclined(m.review_status)),
        guests: guests.filter((g) => isDeclined(g.review_status)),
      },
    };
  }, [members, guests]);

  const counts: Record<Tab, number> = {
    team: buckets.team.length,
    applicants: buckets.applicants.members.length + buckets.applicants.guests.length,
    pitches: buckets.pitches.members.length + buckets.pitches.guests.length,
    declined: buckets.declined.members.length + buckets.declined.guests.length,
  };

  // Land on a tab that actually has something in it, so a lone suggestion is
  // never hidden behind an empty "Applicants" default.
  useEffect(() => {
    if (tabTouched || !data) return;
    if (counts.applicants > 0) return;
    const next: Tab | null =
      counts.pitches > 0 ? "pitches" : counts.team > 0 ? "team" : counts.declined > 0 ? "declined" : null;
    if (next) setTab(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, tabTouched, counts.applicants, counts.pitches, counts.team, counts.declined]);



  const total = members.length + guests.length;
  const waiting =
    members.filter((m) => !m.accepted && m.review_status === "new").length +
    guests.filter((g) => g.review_status === "new").length;
  const hasStale = guests.some(
    (g) =>
      g.review_status === "new" &&
      g.created_at &&
      Date.now() - new Date(g.created_at).getTime() > 48 * 3600_000,
  );

  if (isLoading) {
    return (
      <section className="mt-12">
        <h2 className="font-display text-2xl text-ink">Collaborators</h2>
        <div className="mt-3 h-24 animate-pulse rounded-2xl bg-surface-2" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-12">
        <h2 className="font-display text-2xl text-ink">Collaborators</h2>
        <p className="mt-2 text-sm text-ink-muted">Couldn't load collaborators.</p>
      </section>
    );
  }

  const visible =
    tab === "team"
      ? { members: buckets.team, guests: [] as typeof guests }
      : tab === "applicants"
        ? buckets.applicants
        : tab === "pitches"
          ? buckets.pitches
          : buckets.declined;

  const emptyCopy: Record<Tab, string> = {
    team: "No one has been accepted yet. Accept an applicant to build your team.",
    applicants: "No one has applied to a role yet. Share your post — the link is one tap from the top.",
    pitches: "No suggestions yet. People who pitch their own way in show up here.",
    declined: "Nothing declined.",
  };

  return (
    <section id="applicants" className="mt-12 scroll-mt-24">
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <h2 className="font-display text-2xl text-ink">
          Collaborators <span className="text-ink-muted text-base">({total})</span>
        </h2>
        {waiting > 0 && (
          <span
            className={
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium " +
              (hasStale
                ? "bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/30"
                : "bg-primary/10 text-primary ring-1 ring-primary/20")
            }
          >
            {hasStale && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
              </span>
            )}
            {waiting} waiting on you
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setTabTouched(true);
            }}
            className={
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
              (tab === t.key
                ? "border-ink bg-ink text-surface"
                : "border-border bg-surface text-ink-muted hover:text-ink")
            }
          >
            {t.label} <span className="tabular-nums opacity-70">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {visible.members.length + visible.guests.length === 0 ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-border bg-surface p-6 text-sm text-ink-muted">
          <Inbox className="h-5 w-5 shrink-0" /> {emptyCopy[tab]}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {/* Member applications — link to profile */}
          {visible.members.map((m) => {
            const sender = m.sender;
            const declined = isDeclined(m.review_status);
            return (
              <div
                key={m.id}
                className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 md:flex-row md:items-start"
              >
                <div className="flex items-start gap-3 md:flex-1">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                    {sender?.avatar_url ? (
                      <img src={sender.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <UserCircle2 className="h-full w-full text-ink-muted" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {sender?.username ? (
                        <Link
                          to="/$username"
                          params={{ username: sender.username }}
                          className="font-medium text-ink hover:underline"
                        >
                          {sender.display_name || sender.username}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink">{sender?.display_name ?? "Member"}</span>
                      )}
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-500">
                        Workshop member
                      </span>
                      {m.application_kind === "role" && m.role_name ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                          Role · {m.role_name}
                        </span>
                      ) : m.application_kind === "suggestion" ? (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600">
                          Pitch
                        </span>
                      ) : null}
                      {declined && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-ink-muted">
                          {m.review_status === "spam" ? "Spam" : m.review_status === "withdrawn" ? "Withdrawn" : "Declined"}
                        </span>
                      )}
                    </div>
                    {sender?.headline && <div className="text-xs text-ink-muted">{sender.headline}</div>}
                    {m.message_preview && <p className="mt-2 text-sm text-ink-soft">{m.message_preview}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-stretch gap-1.5 md:items-end">
                  {m.accepted ? (
                    <span className="inline-flex items-center gap-1 self-start rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-600 ring-1 ring-emerald-500/20 md:self-end">
                      <Check className="h-3 w-3" /> On the team
                    </span>
                  ) : declined ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-md gap-1"
                      disabled={reviewMember.isPending}
                      onClick={() => reviewMember.mutate({ contactEventId: m.id, reviewStatus: "new" })}
                    >
                      <Undo2 className="h-3.5 w-3.5" /> Reopen
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        className="rounded-md gap-1"
                        disabled={accept.isPending}
                        onClick={() =>
                          accept.mutate({ applicantUserId: m.sender_user_id, contactEventId: m.id })
                        }
                      >
                        <Check className="h-3.5 w-3.5" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-md gap-1 text-ink-muted hover:text-destructive"
                        disabled={reviewMember.isPending}
                        onClick={() => reviewMember.mutate({ contactEventId: m.id, reviewStatus: "declined" })}
                      >
                        <X className="h-3.5 w-3.5" /> Decline
                      </Button>
                    </>
                  )}
                  {m.conversation_id && (
                    <Button
                      asChild
                      size="sm"
                      variant={m.accepted ? "secondary" : "outline"}
                      className="rounded-md gap-1"
                    >
                      <Link to="/dms/$conversationId" params={{ conversationId: m.conversation_id }}>
                        <Send className="h-3.5 w-3.5" /> {m.accepted ? "Message" : "Reply"}
                      </Link>
                    </Button>
                  )}
                  {sender?.instagram_handle && (
                    <a
                      href={`https://instagram.com/${sender.instagram_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
                    >
                      <Instagram className="h-3.5 w-3.5" /> @{sender.instagram_handle}
                    </a>
                  )}
                </div>
              </div>
            );
          })}

          {/* Guest applications — show full contact, review actions */}
          {visible.guests.map((g) => {
            const declined = isDeclined(g.review_status);
            return (
              <div key={g.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-ink">{g.name}</span>
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-500">
                        Guest
                      </span>
                      {g.application_kind === "role" && g.role_name ? (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                          Role · {g.role_name}
                        </span>
                      ) : g.application_kind === "suggestion" ? (
                        <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600">
                          Pitch
                        </span>
                      ) : null}
                      {g.review_status === "reviewing" && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-ink-muted">
                          In review
                        </span>
                      )}
                      {declined && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-ink-muted">
                          {g.review_status === "spam" ? "Spam" : g.review_status === "withdrawn" ? "Withdrawn" : "Declined"}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{g.message}</p>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <a
                        href={`mailto:${g.email}`}
                        className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-ink hover:bg-muted"
                      >
                        <Mail className="h-3.5 w-3.5" /> {g.email}
                      </a>
                      {g.phone && (
                        <a
                          href={`tel:${g.phone}`}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-ink hover:bg-muted"
                        >
                          <Phone className="h-3.5 w-3.5" /> {g.phone}
                        </a>
                      )}
                      {g.instagram_handle && (
                        <a
                          href={`https://instagram.com/${g.instagram_handle}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-ink hover:bg-muted"
                        >
                          <Instagram className="h-3.5 w-3.5" /> @{g.instagram_handle}
                        </a>
                      )}
                      {g.reel_url && (
                        <a
                          href={g.reel_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-ink hover:bg-muted"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Reel
                        </a>
                      )}
                      {g.portfolio_url && (
                        <a
                          href={g.portfolio_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-ink hover:bg-muted"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Portfolio
                        </a>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-1">
                    {declined ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-md gap-1"
                        disabled={reviewGuest.isPending}
                        onClick={() => reviewGuest.mutate({ id: g.id, reviewStatus: "new" })}
                      >
                        <Undo2 className="h-3.5 w-3.5" /> Reopen
                      </Button>
                    ) : (
                      <>
                        <Button
                          size="sm"
                          variant={g.review_status === "reviewing" ? "secondary" : "outline"}
                          className="rounded-md gap-1"
                          disabled={reviewGuest.isPending}
                          onClick={() =>
                            reviewGuest.mutate({
                              id: g.id,
                              reviewStatus: g.review_status === "reviewing" ? "new" : "reviewing",
                            })
                          }
                        >
                          <Check className="h-3.5 w-3.5" />{" "}
                          {g.review_status === "reviewing" ? "In review" : "Mark in review"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-md gap-1 text-ink-muted hover:text-destructive"
                          disabled={reviewGuest.isPending}
                          onClick={() => reviewGuest.mutate({ id: g.id, reviewStatus: "declined" })}
                        >
                          <X className="h-3.5 w-3.5" /> Decline
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 inline-flex items-center gap-1 text-xs text-ink-muted">
        <MessageCircle className="h-3 w-3" /> Workshop members link to their profile. Guests show full contact info you can reach out to directly.
      </p>
    </section>
  );
}
