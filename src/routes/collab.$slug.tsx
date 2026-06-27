import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Clock, MapPin, DollarSign, ExternalLink, MessageCircle, Trash2, CheckCircle2, Sparkles, Scale, Share2, Users, Inbox, Archive, Pencil, LogOut, AlertTriangle, Eye } from "lucide-react";
import { StateBadge } from "@/components/state-badge";
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
import { closeCollab, extendCollabDeadline } from "@/lib/collab-publish.functions";
import { applyToCollab, listApplicants, getCollabActivity, getCollabPublicCounts, leaveCollab, acceptCollabChanges, getMyCollabMembership, updateCollab } from "@/lib/collab.functions";
import { MessageButton } from "@/components/message-button";
import { VouchRow, useVouchersForPosts } from "@/components/vouch-button";
import { BoostButton } from "@/components/boost-button";
import { OpenLoungeButton } from "@/components/open-lounge-button";
import { WorksBornHere } from "@/components/works-born-here";

import type { Category } from "@/lib/categories";
import { toast } from "sonner";



export const Route = createFileRoute("/collab/$slug")({
  component: CollabDetail,
  loader: async ({ params }) => {
    const { getCollabSeo } = await import("@/lib/seo-loaders.functions");
    const seo = await getCollabSeo({ data: { slug: params.slug } });
    return { seo };
  },
  head: ({ params, loaderData }) => {
    const url = `https://workshopindie.com/collab/${params.slug}`;
    const s = loaderData?.seo;
    const title = s?.title ? `${s.title} — Open Collab on Workshop` : `Open Collab Call — Workshop`;
    const description = s?.description?.slice(0, 160)
      ?? "An open call for collaborators on Workshop. Apply in one tap — no account needed.";
    // Archived (closed + no Work) collabs are owner-only — keep them out of search.
    const isArchived = s?.status === "closed" && !s?.resulting_work_id;
    const ogImage = s?.workCover ?? undefined;
    const meta = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { property: "og:url", content: url },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ];
    if (ogImage) {
      meta.push({ property: "og:image", content: ogImage });
      meta.push({ name: "twitter:image", content: ogImage });
    }
    if (isArchived) meta.push({ name: "robots", content: "noindex,nofollow" });

    // JSON-LD JobPosting for open Collabs — surfaces in Google Jobs and rich results.
    const scripts: { type: string; children: string }[] = [];
    if (s && s.status === "open" && !isArchived) {
      const roleNames = (s.roles ?? [])
        .slice()
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .map((r) => r.role_name)
        .filter(Boolean);
      const validThrough = s.ends_on
        ? new Date(s.ends_on).toISOString()
        : new Date(Date.now() + 30 * 86400000).toISOString();
      const hostName = s.user?.display_name || s.user?.username || "A Workshop creator";
      const isOnline = s.location_mode === "online";
      const cityName = s.city?.name;
      const country = s.city?.country || "US";
      const jobLocation = !isOnline && cityName
        ? {
            "@type": "Place",
            address: { "@type": "PostalAddress", addressLocality: cityName, addressCountry: country },
          }
        : undefined;
      const applicantLocationRequirements = isOnline
        ? { "@type": "Country", name: "Anywhere" }
        : undefined;

      const ld: Record<string, unknown> = {
        "@context": "https://schema.org/",
        "@type": "JobPosting",
        title: s.title ?? "Open Collab",
        description: (s.description ?? "").slice(0, 5000) || `Open Collab call: ${s.title ?? ""}`,
        datePosted: s.created_at ? new Date(s.created_at).toISOString() : new Date().toISOString(),
        validThrough,
        employmentType: s.compensation_type === "paid" ? "CONTRACTOR" : "VOLUNTEER",
        hiringOrganization: {
          "@type": "Organization",
          name: hostName,
          sameAs: s.user?.username ? `https://workshopindie.com/u/${s.user.username}` : "https://workshopindie.com",
        },
        directApply: true,
        url,
      };
      if (jobLocation) ld.jobLocation = jobLocation;
      if (isOnline) {
        ld.jobLocationType = "TELECOMMUTE";
        if (applicantLocationRequirements) ld.applicantLocationRequirements = applicantLocationRequirements;
      }
      if (roleNames.length) ld.industry = roleNames.join(", ");
      if (s.category) ld.occupationalCategory = String(s.category);

      scripts.push({ type: "application/ld+json", children: JSON.stringify(ld) });
    }

    return {
      meta,
      links: [{ rel: "canonical", href: url }],
      scripts,
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
  decide_later: "Rights TBD",
};

function CollabDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const router = useRouter();
  const qc = useQueryClient();
  const closeFn = useServerFn(closeCollab);
  const extendFn = useServerFn(extendCollabDeadline);

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
        .select("id,title,slug,category,description,timeline_text,location_mode,compensation_type,contact_mode,external_contact_url,status,created_at,closed_at,ends_on,resulting_work_id,user_id,live_workshop_id,rights_arrangement,user:profiles!collab_posts_user_id_fkey(id,display_name,username,avatar_url,headline,first_name),city:cities!collab_posts_city_id_fkey(name),roles:collab_roles(id,role_name,quantity,description,sort_order)")
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

  const isOwnerEarly = user?.id === post?.user_id;
  const fetchApplicants = useServerFn(listApplicants);
  const { data: applicantsData } = useQuery({
    queryKey: ["collab-applicants", post?.id],
    queryFn: () => fetchApplicants({ data: { collabPostId: post!.id } }),
    enabled: !!post && !!isOwnerEarly,
  });
  const applicantCount =
    (applicantsData?.members.length ?? 0) + (applicantsData?.guests.length ?? 0);

  const fetchActivity = useServerFn(getCollabActivity);
  const { data: activity } = useQuery({
    queryKey: ["collab-activity", post?.id],
    queryFn: () => fetchActivity({ data: { collabPostId: post!.id } }),
    enabled: !!post && !!isOwnerEarly && post?.status === "open",
    staleTime: 30_000,
  });

  const fetchPublicCounts = useServerFn(getCollabPublicCounts);
  const { data: publicCounts } = useQuery({
    queryKey: ["collab-public-counts", post?.id],
    queryFn: () => fetchPublicCounts({ data: { collabPostId: post!.id } }),
    enabled: !!post && !isOwnerEarly && post?.status === "open",
    staleTime: 60_000,
  });

  const { data: workCollabCount } = useQuery({
    queryKey: ["work-collab-count", post?.resulting_work_id],
    enabled: !!post?.resulting_work_id,
    queryFn: async () => {
      const { count } = await supabase
        .from("work_collaborators")
        .select("id", { count: "exact", head: true })
        .eq("work_id", post!.resulting_work_id!);
      return count ?? 0;
    },
  });



  const fetchMembership = useServerFn(getMyCollabMembership);
  const { data: membership } = useQuery({
    queryKey: ["collab-membership", post?.id, user?.id],
    queryFn: () => fetchMembership({ data: { collabPostId: post!.id } }),
    enabled: !!post && !!user && user.id !== post?.user_id,
    staleTime: 30_000,
  });

  const applyFn = useServerFn(applyToCollab);
  const sendContact = useMutation({
    mutationFn: async () => {
      if (!user || !post) throw new Error("Sign in to contact");
      if (message.trim().length < 10) throw new Error("Please add at least a short note (10+ chars).");
      return applyFn({ data: { collabPostId: post.id, collabRoleId: contactRoleId, message: message.trim() } });
    },
    onSuccess: ({ conversationId }) => {
      toast.success("Sent — continue the conversation", {
        action: { label: "Open DM", onClick: () => router.navigate({ to: "/dms/$conversationId", params: { conversationId } }) },
      });
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
  const extendMut = useMutation({
    mutationFn: (endsOn: string) => extendFn({ data: { collabPostId: post!.id, endsOn } }),
    onSuccess: () => { toast.success("Deadline extended"); qc.invalidateQueries({ queryKey: ["collab", slug] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const leaveFn = useServerFn(leaveCollab);
  const leaveMut = useMutation({
    mutationFn: () => leaveFn({ data: { collabPostId: post!.id } }),
    onSuccess: () => {
      toast.success("You've left this Collab.");
      qc.invalidateQueries({ queryKey: ["collab-membership", post?.id, user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const acceptChangesFn = useServerFn(acceptCollabChanges);
  const acceptChangesMut = useMutation({
    mutationFn: () => acceptChangesFn({ data: { collabPostId: post!.id } }),
    onSuccess: () => {
      toast.success("Changes accepted.");
      qc.invalidateQueries({ queryKey: ["collab-membership", post?.id, user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateFn = useServerFn(updateCollab);
  const publishMut = useMutation({
    mutationFn: () => updateFn({ data: { collabPostId: post!.id, patch: { status: "open" } } }),
    onSuccess: () => {
      toast.success("Draft published — it's now live.");
      qc.invalidateQueries({ queryKey: ["collab", slug] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <main className="mx-auto max-w-3xl p-10"><div className="h-64 animate-pulse rounded-3xl bg-surface-2" /></main>;
  if (!post) return <main className="mx-auto max-w-3xl p-10 text-center text-ink-muted">Not found.</main>;

  const isOwner = user?.id === post.user_id;
  const isArchived = post.status === "closed" && !post.resulting_work_id;
  const isShipped = post.status === "closed" && !!post.resulting_work_id;

  // Archived posts are owner-only. Anyone else gets the standard not-found surface.
  if (isArchived && !isOwner) {
    return (
      <main className="mx-auto max-w-2xl p-10 text-center">
        <h1 className="font-display text-3xl">Not found</h1>
        <p className="mt-2 text-ink-muted">This collab isn't available.</p>
        <Link to="/collab" className="mt-4 inline-block text-ink-soft underline">Back to Collab Board</Link>
      </main>
    );
  }

  const roles = (post.roles ?? []).slice().sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const hostUser = post.user;
  const cityName = post.city?.name;
  const today = new Date().toISOString().slice(0, 10);
  const deadlinePassed = !!post.ends_on && post.ends_on < today && post.status === "open";
  const openedDays = Math.max(0, Math.floor((Date.now() - new Date(post.created_at).getTime()) / 86400000));
  const daysToDeadline = post.ends_on
    ? Math.ceil((new Date(post.ends_on).getTime() - Date.now()) / 86400000)
    : null;
  const closingSoon = post.status === "open" && daysToDeadline !== null && daysToDeadline >= 0 && daysToDeadline <= 7;
  const stateBadge = post.status === "open"
    ? <StateBadge tone="open" label="Open" sublabel={closingSoon ? "Closing soon" : "Casting"} />
    : isShipped
      ? <StateBadge tone="closed" label="Closed" sublabel="Shipped" />
      : <StateBadge tone="closed" label="Closed" sublabel="Archived" />;

  const daysPast = post.ends_on ? Math.floor((Date.now() - new Date(post.ends_on).getTime()) / 86400000) : 0;

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
          {stateBadge}
          {post.status === "open" && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-ink-soft">
              {openedDays === 0 ? "Posted today" : `Open ${openedDays}d`}
            </span>
          )}
          {post.status === "open" && closingSoon && daysToDeadline !== null && (
            <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[11px] font-medium text-amber-700">
              Closes in {daysToDeadline === 0 ? "today" : `${daysToDeadline}d`}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <ShareCollabSheet
              postId={post.id}
              slug={post.slug}
              title={post.title}
              hostName={hostUser?.display_name || hostUser?.username || "A Lounge artist"}
              hostAvatarUrl={hostUser?.avatar_url}
              roles={roles.map((r: { role_name: string }) => r.role_name)}
              category={post.category}
              location={post.location_mode === "online" ? "Online" : (cityName || post.location_mode)}
              compensation={COMP_LABEL[post.compensation_type] ?? post.compensation_type}
            />
            {isOwner ? (
              <>
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
                {post.status === "open" && (
                  <OpenLoungeButton collabPostId={post.id} ownerUserId={post.user_id} />
                )}
                {user && <ReportDialog entityType="collab_post" entityId={post.id} />}
              </>
            )}
          </div>
        </div>



        {/* Owner activity meter (open state) */}
        {isOwner && post.status === "open" && activity && (activity.applicants > 0 || activity.shares > 0) && (
          <p className="mb-3 text-xs text-ink-muted">
            {activity.applicants} {activity.applicants === 1 ? "applicant" : "applicants"}
            {activity.shares > 0 && <> · {activity.shares} {activity.shares === 1 ? "share" : "shares"}</>}
            {activity.applicants >= 3 && <span className="ml-2 text-primary">· Picking up steam</span>}
            {activity.applicants === 0 && openedDays >= 3 && <span className="ml-2">· Quiet so far — try sharing</span>}
          </p>
        )}

        {/* Visitor signal (open state, non-owner) */}
        {!isOwner && post.status === "open" && (
          <p className="mb-3 text-xs text-ink-muted">
            {publicCounts && publicCounts.applicants > 0
              ? <>Cast so far: <span className="text-ink">{publicCounts.applicants}</span> · </>
              : <>Open to applications · </>}
            posted {openedDays === 0 ? "today" : `${openedDays}d ago`}
          </p>
        )}



        {/* Owner: single next-best-action strip */}
        {isOwner && post.status === "open" && !deadlinePassed && (
          (() => {
            const ageHours = (Date.now() - new Date(post.created_at).getTime()) / 3600_000;
            if (applicantCount > 0) {
              return (
                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
                  <Users className="h-5 w-5 text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">
                      {applicantCount} {applicantCount === 1 ? "person is" : "people are"} in. Reply to keep momentum.
                    </p>
                    <p className="text-xs text-ink-muted">Fast replies double the odds people stay engaged.</p>
                  </div>
                  <OpenLoungeButton collabPostId={post.id} ownerUserId={post.user_id} />
                  <Button size="sm" className="rounded-full gap-1" asChild>
                    <a href="#applicants">
                      <Inbox className="h-3.5 w-3.5" /> Review applicants
                    </a>
                  </Button>
                </div>
              );
            }
            if (ageHours < 72) {
              return (
                <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4">
                  <Share2 className="h-5 w-5 text-ink-muted" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">Share it — that's how applicants find you.</p>
                    <p className="text-xs text-ink-muted">Drop the link in your IG story or a group chat. No account needed to apply.</p>
                  </div>
                  <OpenLoungeButton collabPostId={post.id} ownerUserId={post.user_id} />
                </div>
              );
            }
            return (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface p-4">
                <Sparkles className="h-5 w-5 text-ink-muted" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">Quiet so far. Try opening the Lounge or another share.</p>
                  <p className="text-xs text-ink-muted">A live session and one fresh share usually unstick a post.</p>
                </div>
                <OpenLoungeButton collabPostId={post.id} ownerUserId={post.user_id} />
              </div>
            );
          })()
        )}



        {/* Owner-only: deadline passed but post still open — never auto-acts, just prompts */}
        {isOwner && deadlinePassed && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
            <Clock className="h-5 w-5 text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">
                Your deadline passed {daysPast === 0 ? "today" : `${daysPast} day${daysPast === 1 ? "" : "s"} ago`}.
              </p>
              <p className="text-xs text-ink-muted">It's hidden from the public board but still live for you. What's next?</p>
            </div>
            <Button size="sm" variant="ghost" className="rounded-full gap-1 text-ink-muted" onClick={() => {
              const next = prompt("Extend until (YYYY-MM-DD)", new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
              if (next && /^\d{4}-\d{2}-\d{2}$/.test(next)) extendMut.mutate(next);
            }}>
              <Clock className="h-3.5 w-3.5" /> Extend
            </Button>
            <Button size="sm" variant="outline" className="rounded-full gap-1" onClick={() => { if (confirm("Close this collab without publishing?")) closeMut.mutate(); }}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Close
            </Button>
            <Button size="sm" className="rounded-full gap-1" onClick={() => setPublishOpen(true)}>
              <Sparkles className="h-3.5 w-3.5" /> Publish Work
            </Button>
          </div>
        )}

        {/* Owner-only nudge once closed but no Work published yet — this post is archived for everyone else */}
        {isOwner && isArchived && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface-2/60 p-4">
            <Archive className="h-5 w-5 text-ink-soft" />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-ink">Archived{post.closed_at ? ` on ${new Date(post.closed_at).toLocaleDateString()}` : ""}.</p>
              <p className="text-xs text-ink-muted">Only you can see this page. Publish a Work to make it public, or delete it.</p>
            </div>
            <Button size="sm" variant="ghost" className="rounded-full gap-1 text-ink-muted" onClick={() => { if (confirm("Delete this post permanently?")) deletePost.mutate(); }}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
            <Button size="sm" className="rounded-full gap-1" onClick={() => setPublishOpen(true)}>
              <Sparkles className="h-3.5 w-3.5" /> Publish a Work from this
            </Button>
          </div>
        )}


        {/* Shipped hero — promotes the Work as the answer */}
        {isShipped && resultingWork && (
          <Link
            to="/works/$slug"
            params={{ slug: resultingWork.slug }}
            className="mb-6 block overflow-hidden rounded-3xl border border-border bg-surface shadow-soft transition hover:shadow-lift"
          >
            {resultingWork.cover_url ? (
              <img src={resultingWork.cover_url} alt={resultingWork.title} className="aspect-video w-full object-cover" />
            ) : (
              <div className="aspect-video w-full gradient-motion" />
            )}
            <div className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-wide text-ink-muted">From this Collab</p>
                <p className="truncate font-display text-xl text-ink">{resultingWork.title}</p>
              </div>
              <Button size="sm" className="rounded-full gap-1 shrink-0">
                View the Work <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
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

        <CollabSocialProof postId={post.id} authorId={post.user_id} />

        {hostUser && (
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Link to="/u/$username" params={{ username: hostUser.username || "" }} className="inline-flex flex-1 min-w-[14rem] items-center gap-3 rounded-2xl border border-border bg-surface p-3 hover:bg-surface-2 transition">
              <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
                {hostUser.avatar_url && <img src={hostUser.avatar_url} alt="" className="h-full w-full object-cover" />}
              </div>
              <div>
                <div className="font-medium text-ink">{hostUser.display_name || hostUser.username}</div>
                {hostUser.headline && <div className="text-xs text-ink-muted">{hostUser.headline}</div>}
              </div>
            </Link>
            {!isOwner && <MessageButton otherUserId={hostUser.id} contextCollabPostId={post.id} />}
            {post.status === "open" && (
              <OpenLoungeButton collabPostId={post.id} ownerUserId={post.user_id} />
            )}
          </div>
        )}

        {post.description && (
          <div className="prose prose-sm mt-8 max-w-none whitespace-pre-wrap text-ink">{post.description}</div>
        )}

        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">Roles</h2>
          {isShipped ? (
            <p className="mt-3 text-sm text-ink-muted">
              Cast · {workCollabCount ?? roles.length} {((workCollabCount ?? roles.length) === 1) ? "collaborator" : "collaborators"}
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {roles.map((r: any) => {
                const interested = activity?.perRole?.[r.id] ?? 0;
                return (
                  <div key={r.id} className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-baseline gap-2">
                        <h3 className="font-medium text-ink">{r.role_name}</h3>
                        <span className="text-xs text-ink-muted">×{r.quantity}</span>
                        {isOwner && interested > 0 && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                            {interested} interested
                          </span>
                        )}
                      </div>
                      {r.description && <p className="mt-1 text-sm text-ink-muted">{r.description}</p>}
                    </div>
                    {!isOwner && post.status === "open" && (
                      <Button size="sm" className="rounded-full gap-1" onClick={() => openContact(r.id)}>
                        {post.contact_mode === "external_link" && user ? <><ExternalLink className="h-3.5 w-3.5" /> Reach out</> : <><MessageCircle className="h-3.5 w-3.5" /> I'm in</>}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

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

      {/* Reverse provenance — public Works born from this Collab. */}
      <WorksBornHere collabPostId={post.id} excludeWorkId={post.resulting_work_id ?? null} />
    </main>
  );
}

function CollabSocialProof({ postId, authorId }: { postId: string; authorId: string }) {
  const { data: vouchersByPost } = useVouchersForPosts([postId]);
  const vouchers = vouchersByPost.get(postId) ?? [];
  const { data: post } = useQuery({
    queryKey: ["collab-detail-counts", postId],
    queryFn: async () => {
      const { data } = await supabase
        .from("collab_posts")
        .select("vouch_count,boost_count")
        .eq("id", postId)
        .maybeSingle();
      return data as { vouch_count: number | null; boost_count: number | null } | null;
    },
    staleTime: 15_000,
  });
  return (
    <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface p-3">
      <div className="flex-1 min-w-[200px]">
        <VouchRow
          postId={postId}
          authorId={authorId}
          vouchCount={post?.vouch_count ?? vouchers.length}
          vouchers={vouchers}
        />
      </div>
      <BoostButton postId={postId} authorId={authorId} size="md" />
    </div>
  );
}
