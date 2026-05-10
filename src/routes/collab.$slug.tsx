import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, MapPin, DollarSign, ExternalLink, MessageCircle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CategoryChip } from "@/components/category-chip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ReportDialog } from "@/components/report-dialog";
import type { Category } from "@/lib/categories";
import { useDocumentMeta } from "@/lib/seo";
import { toast } from "sonner";

export const Route = createFileRoute("/collab/$slug")({
  component: CollabDetail,
  errorComponent: ({ error }) => <main className="mx-auto max-w-2xl p-10 text-center text-ink-muted">{error.message}</main>,
  notFoundComponent: () => <main className="mx-auto max-w-2xl p-10 text-center"><h1 className="font-display text-3xl">Not found</h1><Link to="/collab" className="mt-4 inline-block text-ink-soft underline">Back to Collab Board</Link></main>,
});

const COMP_LABEL: Record<string, string> = {
  paid: "Paid", unpaid: "Unpaid", credit: "Credit", negotiable: "Negotiable", unspecified: "Comp TBD",
};

function CollabDetail() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const router = useRouter();
  
  const [contactOpen, setContactOpen] = useState(false);
  const [contactRoleId, setContactRoleId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const { data: post, isLoading } = useQuery({
    queryKey: ["collab", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collab_posts")
        .select("id,title,slug,category,description,timeline_text,location_mode,compensation_type,contact_mode,external_contact_url,status,created_at,user_id,user:profiles!collab_posts_user_id_fkey(id,display_name,username,avatar_url,headline),city:cities!collab_posts_city_id_fkey(name),roles:collab_roles(id,role_name,quantity,description,sort_order)")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useDocumentMeta({
    title: post?.title,
    description: post?.description?.slice(0, 160) ?? "Open collab call on Workshop.",
    type: "article",
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

  if (isLoading) return <main className="mx-auto max-w-3xl p-10"><div className="h-64 animate-pulse rounded-3xl bg-surface-2" /></main>;
  if (!post) return <main className="mx-auto max-w-3xl p-10 text-center text-ink-muted">Not found.</main>;

  const isOwner = user?.id === post.user_id;
  const roles = (post.roles ?? []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order);

  function openContact(roleId: string | null) {
    if (!user) { router.navigate({ to: "/login" }); return; }
    if (post!.contact_mode === "external_link" && post!.external_contact_url) {
      window.open(post!.external_contact_url, "_blank", "noopener,noreferrer");
      // Still log the event so the host sees who clicked.
      supabase.from("collab_contact_events").insert({
        collab_post_id: post!.id, collab_role_id: roleId, sender_user_id: user.id, message_preview: "(opened external link)",
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
          {isOwner ? (
            <Button size="sm" variant="ghost" className="ml-auto rounded-full text-ink-muted gap-1" onClick={() => { if (confirm("Delete this post?")) deletePost.mutate(); }}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          ) : (
            user && <div className="ml-auto"><ReportDialog entityType="collab_post" entityId={post.id} /></div>
          )}
        </div>
        <h1 className="font-display text-4xl text-ink md:text-5xl">{post.title}</h1>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1"><DollarSign className="h-4 w-4" /> {COMP_LABEL[post.compensation_type] ?? post.compensation_type}</span>
          <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {post.location_mode === "online" ? "Online" : (post.city as any)?.name || post.location_mode}</span>
          {post.timeline_text && <span className="inline-flex items-center gap-1"><Clock className="h-4 w-4" /> {post.timeline_text}</span>}
        </div>

        {post.user && (
          <Link to="/u/$username" params={{ username: (post.user as any).username || "" }} className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 hover:bg-surface-2 transition">
            <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
              {(post.user as any).avatar_url && <img src={(post.user as any).avatar_url} alt="" className="h-full w-full object-cover" />}
            </div>
            <div>
              <div className="font-medium text-ink">{(post.user as any).display_name || (post.user as any).username}</div>
              {(post.user as any).headline && <div className="text-xs text-ink-muted">{(post.user as any).headline}</div>}
            </div>
          </Link>
        )}

        {post.description && (
          <div className="prose prose-sm mt-8 max-w-none whitespace-pre-wrap text-ink">
            {post.description}
          </div>
        )}

        <section className="mt-10">
          <h2 className="font-display text-2xl text-ink">Roles</h2>
          <div className="mt-3 space-y-2">
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
                    {post.contact_mode === "external_link" ? <><ExternalLink className="h-3.5 w-3.5" /> Reach out</> : <><MessageCircle className="h-3.5 w-3.5" /> I'm in</>}
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
      </motion.div>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tell {((post.user as any)?.display_name || "the host")} you're in</DialogTitle></DialogHeader>
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
    </main>
  );
}
