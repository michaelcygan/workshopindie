import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Clock, MapPin, DollarSign, ExternalLink, MessageCircle, Trash2, CheckCircle2, Sparkles, RotateCcw, Radio, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CategoryChip } from "@/components/category-chip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ReportDialog } from "@/components/report-dialog";
import { ShareCollabSheet } from "@/components/share-collab-sheet";
import { GuestApplyDialog } from "@/components/guest-apply-dialog";
import { ApplicantsPanel } from "@/components/applicants-panel";
import { PublishFromCollabSheet } from "@/components/publish-from-collab-sheet";
import { closeCollab, reopenCollab } from "@/lib/collab-publish.functions";
import { openWorkshopOnCollab } from "@/lib/collab-workshop.functions";
import type { Category } from "@/lib/categories";
import { toast } from "sonner";

export const Route = createFileRoute("/collab/$slug")({
  component: CollabDetail,
  head: ({ params }) => {
    const url = `https://workshopindie.com/collab/${params.slug}`;
    const title = `Open Collab Call — Workshop`;
    const description = "An open call for collaborators on Workshop. Apply in one tap — no account needed.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  errorComponent: ({ error }) => <main className="mx-auto max-w-2xl p-10 text-center text-ink-muted">{error.message}</main>,
  notFoundComponent: () => <main className="mx-auto max-w-2xl p-10 text-center"><h1 className="font-display text-3xl">Not found</h1><Link to="/collab" className="mt-4 inline-block text-ink-soft underline">Back to Collab Board</Link></main>,
});

const COMP_LABEL: Record<string, string> = {
  paid: "Paid", unpaid: "Unpaid", credit: "Credit", negotiable: "Negotiable", unspecified: "Comp TBD",
};

const RIGHTS_LABEL: Record<string, string> = {
  owner_retains: "Owner keeps rights",
  equal_split: "Equal split",
  creative_commons: "Creative Commons",
};

function CollabDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const closeFn = useServerFn(closeCollab);
  const reopenFn = useServerFn(reopenCollab);
  const openWorkshopFn = useServerFn(openWorkshopOnCollab);

  const [contactOpen, setContactOpen] = useState(false);
  const [contactRoleId, setContactRoleId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestRoleId, setGuestRoleId] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);

  const { data: post, isLoading } = useQuery({
    queryKey: ["collab", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collab_posts")
        .select("id,title,slug,category,description,timeline_text,location_mode,compensation_type,contact_mode,external_contact_url,status,created_at,closed_at,resulting_work_id,user_id,live_workshop_id,rights_arrangement,user:profiles!collab_posts_user_id_fkey(id,display_name,username,avatar_url,headline,first_name),city:cities!collab_posts_city_id_fkey(name),roles:collab_roles(id,role_name,quantity,description,sort_order)")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: resultingWork } = useQuery({
    queryKey: ["collab-resulting-work", post?.resulting_work_id],
    enabled: !!post?.resulting_work_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("works")
        .select("id,slug,title,cover_url,category")
        .eq("id", post!.resulting_work_id!)
        .maybeSingle();
      return data;
    },
  });

  const { data: liveWorkshop } = useQuery({
    queryKey: ["collab-live-workshop", post?.live_workshop_id],
    enabled: !!post?.live_workshop_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("workshops")
        .select("id,slug,status")
        .eq("id", post!.live_workshop_id!)
        .maybeSingle();
      return data;
    },
  });
  const isLive = !!liveWorkshop && (liveWorkshop.status === "active" || liveWorkshop.status === "check_in");

  const openWorkshopMut = useMutation({
    mutationFn: () => openWorkshopFn({ data: { collabPostId: post!.id } }),
    onSuccess: ({ slug: wsSlug }) => {
      toast.success("Workshop is live — heading in");
      qc.invalidateQueries({ queryKey: ["collab", slug] });
      router.navigate({ to: "/workshops/$slug", params: { slug: wsSlug } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendContact = useMutation({
    mutationFn: async () => {
      if (!user || !post) throw new Error("Sign in to contact");
      const { error } = await supabase.from("collab_contact_events").insert({
        collab_post_id: post.id,
        collab_role_id: contactRoleId,
        sender_user_id: user.id,
        message_preview: message.slice(0, 280),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Interest sent — the host will see this");
      setContactOpen(false); setMessage(""); setContactRoleId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePost = useMutation({
    mutationFn: async () => {
      if (!post) return;
      const { error } = await supabase.from("collab_posts").delete().eq("id", post.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Post removed"); router.navigate({ to: "/collab" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeMut = useMutation({
    mutationFn: () => closeFn({ data: { collabPostId: post!.id } }),
    onSuccess: () => { toast.success("Collab closed"); qc.invalidateQueries({ queryKey: ["collab", slug] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reopenMut = useMutation({
    mutationFn: () => reopenFn({ data: { collabPostId: post!.id } }),
    onSuccess: () => { toast.success("Reopened"); qc.invalidateQueries({ queryKey: ["collab", slug] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <main className="mx-auto max-w-3xl p-10"><div className="h-64 animate-pulse rounded-3xl bg-surface-2" /></main>;
  if (!post) return <main className="mx-auto max-w-3xl p-10 text-center text-ink-muted">Not found.</main>;

  const isOwner = user?.id === post.user_id;
  const roles = (post.roles ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const hostUser = post.user;
  const cityName = post.city?.name;

  function openContact(roleId: string | null) {
    if (!post) return;
    // Logged out → open the guest application dialog instead of redirecting away.
    if (!user) {
      setGuestRoleId(roleId);
      setGuestOpen(true);
      return;
    }
    if (post.contact_mode === "external_link" && post.external_contact_url) {
      window.open(post.external_contact_url, "_blank", "noopener,noreferrer");
      supabase.from("collab_contact_events").insert({
        collab_post_id: post.id, collab_role_id: roleId, sender_user_id: user.id, message_preview: "(opened external link)",
      });
      return;
    }
    setContactRoleId(roleId);
    setContactOpen(true);
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 md:py-14">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-4 flex items-center gap-2">
          <CategoryChip category={post.category as Category} />
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-ink-soft">{post.status}</span>
          <div className="ml-auto flex items-center gap-2">
            <ShareCollabSheet
              postId={post.id}
              slug={post.slug}
              title={post.title}
              hostName={hostUser?.display_name || hostUser?.username || "A Workshop artist"}
              hostAvatarUrl={hostUser?.avatar_url}
              roles={roles.map((r: { role_name: string }) => r.role_name)}
              category={post.category}
              location={post.location_mode === "online" ? "Online" : (cityName || post.location_mode)}
              compensation={COMP_LABEL[post.compensation_type] ?? post.compensation_type}
            />
            {isOwner ? (
              <>
                {post.status === "open" && (
                  isLive ? (
                    <Button size="sm" className="rounded-full gap-1" onClick={() => router.navigate({ to: "/workshops/$slug", params: { slug: liveWorkshop!.slug } })}>
                      <Radio className="h-3.5 w-3.5" /> Rejoin Workshop
                    </Button>
                  ) : (
                    <Button size="sm" className="rounded-full gap-1" disabled={openWorkshopMut.isPending} onClick={() => openWorkshopMut.mutate()}>
                      <Radio className="h-3.5 w-3.5" /> {openWorkshopMut.isPending ? "Opening…" : "Open a Workshop on this"}
                    </Button>
                  )
                )}
                {post.status === "open" && (
                  <Button size="sm" variant="outline" className="rounded-full gap-1" onClick={() => { if (confirm("Mark this collab as closed? You can still publish the Work that came out of it.")) closeMut.mutate(); }}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Close
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="rounded-full text-ink-muted gap-1" onClick={() => { if (confirm("Delete this post?")) deletePost.mutate(); }}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </>
            ) : (
              <>
                {isLive && (
                  <Button size="sm" className="rounded-full gap-1 bg-primary" onClick={() => router.navigate({ to: "/workshops/$slug", params: { slug: liveWorkshop!.slug } })}>
                    <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-white" /></span>
                    Live now — join
                  </Button>
                )}
                {user && <ReportDialog entityType="collab_post" entityId={post.id} />}
              </>
            )}
          </div>
        </div>

        {/* Owner-only nudge once closed but no Work published yet */}
        {isOwner && post.status === "closed" && !post.resulting_work_id && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">Made something? Publish the Work.</p>
              <p className="text-xs text-ink-muted">Three taps — your collaborators get credit automatically.</p>
            </div>
            <Button size="sm" variant="ghost" className="rounded-full gap-1 text-ink-muted" onClick={() => reopenMut.mutate()}>
              <RotateCcw className="h-3.5 w-3.5" /> Reopen
            </Button>
            <Button size="sm" className="rounded-full gap-1" onClick={() => setPublishOpen(true)}>
              <Sparkles className="h-3.5 w-3.5" /> Publish Work
            </Button>
          </div>
        )}

        {/* Public "this collab produced →" card, shown to everyone once linked */}
        {resultingWork && (
          <Link to="/works/$slug" params={{ slug: resultingWork.slug }} className="mb-6 flex items-center gap-4 rounded-2xl border border-border bg-surface p-3 transition hover:shadow-lift">
            {resultingWork.cover_url ? (
              <img src={resultingWork.cover_url} alt="" className="h-16 w-14 rounded-xl object-cover" />
            ) : (
              <div className="h-16 w-14 rounded-xl gradient-motion" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide text-ink-muted">This collab produced</p>
              <p className="truncate font-display text-lg text-ink">{resultingWork.title}</p>
            </div>
            <ExternalLink className="h-4 w-4 text-ink-muted" />
          </Link>
        )}
        <h1 className="font-display text-4xl text-ink md:text-5xl">{post.title}</h1>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1"><DollarSign className="h-4 w-4" /> {COMP_LABEL[post.compensation_type] ?? post.compensation_type}</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {post.location_mode === "online" ? "Online" : (cityName || post.location_mode)}</span>
          {post.timeline_text && <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> {post.timeline_text}</span>}
          {post.rights_arrangement && RIGHTS_LABEL[post.rights_arrangement] && (
            <span className="inline-flex items-center gap-1"><Scale className="h-4 w-4" /> {RIGHTS_LABEL[post.rights_arrangement]}</span>
          )}
        </div>

        {hostUser && (
          <Link to="/u/$username" params={{ username: hostUser.username || "" }} className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 hover:bg-surface-2 transition">
            <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
              {hostUser.avatar_url && <img src={hostUser.avatar_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <div>
              <div className="font-medium text-ink">{hostUser.display_name || hostUser.username}</div>
              {hostUser.headline && <div className="text-xs text-ink-muted">{hostUser.headline}</div>}
            </div>
          </Link>
        )}

        {post.description && (
          <div className="prose prose-sm mt-8 max-w-none whitespace-pre-wrap text-ink">{post.description}</div>
        )}

        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">Roles</h2>
          <div className="mt-3 space-y-2">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {roles.map((r: any) => (
              <div key={r.id} className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
                <div className="flex-1">
                  <div className="flex items-baseline gap-2">
                    <h3 className="font-medium text-ink">{r.role_name}</h3>
                    <span className="text-xs text-ink-muted">×{r.quantity}</span>
                  </div>
                  {r.description && <p className="mt-1 text-sm text-ink-muted">{r.description}</p>}
                </div>
                {!isOwner && post.status === "open" && (
                  <Button size="sm" className="rounded-full gap-1" onClick={() => openContact(r.id)}>
                    {post.contact_mode === "external_link" && user ? <><ExternalLink className="h-3.5 w-3.5" /> Reach out</> : <><MessageCircle className="h-3.5 w-3.5" /> I'm in</>}
                  </Button>
                )}
              </div>
            ))}
          </div>

          {!isOwner && post.status === "open" && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" className="rounded-full gap-2" onClick={() => openContact(null)}>
                <MessageCircle className="h-4 w-4" /> General interest (no specific role)
              </Button>
            </div>
          )}
        </section>

        {isOwner && <ApplicantsPanel postId={post.id} />}
      </motion.div>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tell {(hostUser?.display_name || "the host")} you're in</DialogTitle></DialogHeader>
          <Textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Quick intro: who you are, why this caught your eye, links to your work…" />
          <p className="text-xs text-ink-muted">They'll get a notification with your message and a link to your profile.</p>
          <DialogFooter>
            <Button variant="ghost" className="rounded-full" onClick={() => setContactOpen(false)}>Cancel</Button>
            <Button className="rounded-full" disabled={!message.trim() || sendContact.isPending} onClick={() => sendContact.mutate()}>
              {sendContact.isPending ? "Sending…" : "Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GuestApplyDialog
        open={guestOpen}
        onOpenChange={setGuestOpen}
        collabPostId={post.id}
        collabRoleId={guestRoleId}
        postTitle={post.title}
        hostFirstName={hostUser?.first_name || hostUser?.display_name?.split(" ")[0] || ""}
      />

      {isOwner && (
        <PublishFromCollabSheet
          open={publishOpen}
          onOpenChange={setPublishOpen}
          postId={post.id}
          postTitle={post.title}
          postDescription={post.description}
        />
      )}
    </main>
  );
}
