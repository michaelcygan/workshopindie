import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Mail,
  Phone,
  ExternalLink,
  Instagram,
  Check,
  Trash2,
  Inbox,
  UserCircle2,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { listApplicants, updateGuestApplicationStatus } from "@/lib/collab.functions";
import { toast } from "sonner";

type Props = { postId: string };

export function ApplicantsPanel({ postId }: Props) {
  const fetchApplicants = useServerFn(listApplicants);
  const updateStatus = useServerFn(updateGuestApplicationStatus);
  const qc = useQueryClient();

  const { data, isLoading, error } = useQuery({
    queryKey: ["collab-applicants", postId],
    queryFn: () => fetchApplicants({ data: { collabPostId: postId } }),
  });

  const setStatus = useMutation({
    mutationFn: (vars: { id: string; status: "new" | "contacted" | "spam" | "hidden" }) =>
      updateStatus({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collab-applicants", postId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return (
      <section className="mt-12">
        <h2 className="font-display text-2xl text-ink">Applicants</h2>
        <div className="mt-3 h-24 animate-pulse rounded-2xl bg-surface-2" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-12">
        <h2 className="font-display text-2xl text-ink">Applicants</h2>
        <p className="mt-2 text-sm text-ink-muted">Couldn't load applicants.</p>
      </section>
    );
  }

  const members = data?.members ?? [];
  const guests = data?.guests ?? [];
  const total = members.length + guests.length;

  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-2xl text-ink">Applicants <span className="text-ink-muted text-base">({total})</span></h2>
      </div>

      {total === 0 ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-border bg-surface p-6 text-ink-muted">
          <Inbox className="h-5 w-5" /> Nothing yet. Share your post — link is one tap from the top.
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {/* Member applicants — link to profile */}
          {members.map((m) => {
            const sender = (m as { sender: { username?: string; display_name?: string; avatar_url?: string; headline?: string; instagram_handle?: string } | null }).sender;
            return (
              <div key={m.id} className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 md:flex-row md:items-start">
                <div className="flex items-start gap-3 md:flex-1">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted">
                    {sender?.avatar_url ? <img src={sender.avatar_url} alt="" className="h-full w-full object-cover" /> : <UserCircle2 className="h-full w-full text-ink-muted" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {sender?.username ? (
                        <Link to="/u/$username" params={{ username: sender.username }} className="font-medium text-ink hover:underline">
                          {sender.display_name || sender.username}
                        </Link>
                      ) : (
                        <span className="font-medium text-ink">{sender?.display_name ?? "Member"}</span>
                      )}
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-500">Workshop member</span>
                    </div>
                    {sender?.headline && <div className="text-xs text-ink-muted">{sender.headline}</div>}
                    {m.message_preview && <p className="mt-2 text-sm text-ink-soft">{m.message_preview}</p>}
                  </div>
                </div>
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
            );
          })}

          {/* Guest applicants — show full contact, status toggles */}
          {guests.map((g) => (
            <div key={g.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-ink">{g.name}</span>
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-500">Guest</span>
                    {g.status === "contacted" && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-ink-muted">Contacted</span>}
                    {g.status === "spam" && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] text-destructive">Spam</span>}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{g.message}</p>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <a href={`mailto:${g.email}`} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-ink hover:bg-muted">
                      <Mail className="h-3.5 w-3.5" /> {g.email}
                    </a>
                    {g.phone && (
                      <a href={`tel:${g.phone}`} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-ink hover:bg-muted">
                        <Phone className="h-3.5 w-3.5" /> {g.phone}
                      </a>
                    )}
                    {g.instagram_handle && (
                      <a href={`https://instagram.com/${g.instagram_handle}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-ink hover:bg-muted">
                        <Instagram className="h-3.5 w-3.5" /> @{g.instagram_handle}
                      </a>
                    )}
                    {g.reel_url && (
                      <a href={g.reel_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-ink hover:bg-muted">
                        <ExternalLink className="h-3.5 w-3.5" /> Reel
                      </a>
                    )}
                    {g.portfolio_url && (
                      <a href={g.portfolio_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-ink hover:bg-muted">
                        <ExternalLink className="h-3.5 w-3.5" /> Portfolio
                      </a>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col gap-1">
                  <Button
                    size="sm"
                    variant={g.status === "contacted" ? "secondary" : "outline"}
                    className="rounded-full gap-1"
                    onClick={() => setStatus.mutate({ id: g.id, status: g.status === "contacted" ? "new" : "contacted" })}
                  >
                    <Check className="h-3.5 w-3.5" /> {g.status === "contacted" ? "Done" : "Mark contacted"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="rounded-full gap-1 text-ink-muted hover:text-destructive"
                    onClick={() => setStatus.mutate({ id: g.id, status: g.status === "spam" ? "new" : "spam" })}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {g.status === "spam" ? "Unspam" : "Spam"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 inline-flex items-center gap-1 text-xs text-ink-muted">
        <MessageCircle className="h-3 w-3" /> Workshop members link to their profile. Guests show full contact info you can reach out to directly.
      </p>
    </section>
  );
}
