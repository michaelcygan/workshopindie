import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, type Category, categoryClass } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/collab/new")({ component: NewCollab });

type LocationMode = "online" | "in_person" | "hybrid";
type CompType = "paid" | "unpaid" | "credit" | "negotiable" | "unspecified";
type ContactMode = "email_relay" | "external_link";
type RoleDraft = { role_name: string; quantity: number; description: string };

const COMP_OPTIONS: { id: CompType; label: string }[] = [
  { id: "paid", label: "Paid" },
  { id: "credit", label: "Credit only" },
  { id: "negotiable", label: "Negotiable" },
  { id: "unpaid", label: "Unpaid / passion" },
  { id: "unspecified", label: "Not specified" },
];

function NewCollab() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("visual");
  const [description, setDescription] = useState("");
  const [timeline, setTimeline] = useState("");
  const [locationMode, setLocationMode] = useState<LocationMode>("online");
  const [cityId, setCityId] = useState<string | "">("");
  const [comp, setComp] = useState<CompType>("unspecified");
  const [contactMode, setContactMode] = useState<ContactMode>("email_relay");
  const [externalUrl, setExternalUrl] = useState("");
  const [roles, setRoles] = useState<RoleDraft[]>([
    { role_name: "Collaborator", quantity: 1, description: "" },
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  const { data: cities } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data } = await supabase.from("cities").select("id,name").order("name").limit(200);
      return data ?? [];
    },
  });

  function updateRole(i: number, patch: Partial<RoleDraft>) {
    setRoles((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function removeRole(i: number) { setRoles((rs) => rs.filter((_, idx) => idx !== i)); }
  function addRole() { setRoles((rs) => [...rs, { role_name: "", quantity: 1, description: "" }]); }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) return toast.error("Give your post a title");
    if (contactMode === "external_link" && !externalUrl.trim()) return toast.error("Add a link people can use to contact you");
    const cleanRoles = roles.filter((r) => r.role_name.trim() && r.quantity > 0);
    if (cleanRoles.length === 0) return toast.error("Add at least one role");

    setSubmitting(true);
    const { data: post, error } = await supabase.from("collab_posts").insert({
      title: title.trim(),
      slug: "",
      category,
      description: description || null,
      timeline_text: timeline || null,
      location_mode: locationMode,
      city_id: cityId || null,
      compensation_type: comp,
      contact_mode: contactMode,
      external_contact_url: contactMode === "external_link" ? externalUrl.trim() : null,
      user_id: user.id,
      status: "open",
    }).select("id,slug").single();

    if (error || !post) { setSubmitting(false); return toast.error(error?.message ?? "Couldn't post"); }

    const { error: rolesErr } = await supabase.from("collab_roles").insert(
      cleanRoles.map((r, i) => ({
        collab_post_id: post.id,
        role_name: r.role_name.trim(),
        quantity: r.quantity,
        description: r.description || null,
        sort_order: i,
      })),
    );
    if (rolesErr) toast.error(rolesErr.message);

    setSubmitting(false);
    toast.success("Posted to the Collab Board");
    navigate({ to: "/collab/$slug", params: { slug: post.slug } });
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:py-14">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl text-ink">Post a call</h1>
        <p className="mt-1 text-ink-muted">Describe the idea and the roles you need. People reach out, you decide who's in.</p>
      </motion.div>

      <form onSubmit={onSubmit} className="mt-8 space-y-7">
        <section className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" required maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Looking for a vocalist for a moody synthwave EP" />
        </section>

        <section className="space-y-2">
          <Label>Category</Label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button type="button" key={c.id} onClick={() => setCategory(c.id)}
                className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                  category === c.id ? cn("border-transparent", categoryClass(c.id)) : "border-border bg-surface text-ink-soft hover:bg-muted")}>
                {c.label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-1.5">
          <Label htmlFor="desc">What's the idea</Label>
          <Textarea id="desc" rows={5} maxLength={3000} value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="What are you making? What's the vibe? What's already done? What does success look like?" />
        </section>

        <section className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="timeline">Timeline</Label>
            <Input id="timeline" maxLength={80} value={timeline} onChange={(e) => setTimeline(e.target.value)} placeholder="Next 2 weeks" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="city">City</Label>
            <select id="city" value={cityId} onChange={(e) => setCityId(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm">
              <option value="">Anywhere</option>
              {cities?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </section>

        <section className="space-y-2">
          <Label>Where</Label>
          <div className="flex flex-wrap gap-2">
            {(["online", "in_person", "hybrid"] as LocationMode[]).map((t) => (
              <button key={t} type="button" onClick={() => setLocationMode(t)}
                className={cn("rounded-full border px-3 py-1.5 text-sm capitalize transition",
                  locationMode === t ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted")}>
                {t.replace("_", " ")}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <Label>Compensation</Label>
          <div className="flex flex-wrap gap-2">
            {COMP_OPTIONS.map((c) => (
              <button key={c.id} type="button" onClick={() => setComp(c.id)}
                className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                  comp === c.id ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted")}>
                {c.label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <Label>How should people reach you</Label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setContactMode("email_relay")}
              className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                contactMode === "email_relay" ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted")}>
              In-app message
            </button>
            <button type="button" onClick={() => setContactMode("external_link")}
              className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                contactMode === "external_link" ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted")}>
              External link
            </button>
          </div>
          {contactMode === "external_link" && (
            <Input className="mt-2" type="url" placeholder="https://… (your contact form, IG, email, etc.)"
              value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} />
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Roles you need</Label>
            <Button type="button" size="sm" variant="ghost" className="rounded-full gap-1" onClick={addRole}>
              <Plus className="h-3.5 w-3.5" /> Add role
            </Button>
          </div>
          <div className="space-y-2">
            {roles.map((r, i) => (
              <div key={i} className="space-y-2 rounded-xl border border-border bg-surface p-3">
                <div className="flex items-center gap-2">
                  <Input className="flex-1" placeholder="Role (e.g. Vocalist)" value={r.role_name} onChange={(e) => updateRole(i, { role_name: e.target.value })} />
                  <Input type="number" min={1} max={20} className="w-20" value={r.quantity} onChange={(e) => updateRole(i, { quantity: Math.max(1, Number(e.target.value)) })} />
                  <button type="button" onClick={() => removeRole(i)} className="rounded-full p-1.5 text-ink-muted hover:bg-muted">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <Textarea rows={2} placeholder="What you're looking for in this role (optional)" value={r.description} onChange={(e) => updateRole(i, { description: e.target.value })} />
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => navigate({ to: "/collab" })}>Cancel</Button>
          <Button type="submit" disabled={submitting} className="rounded-full">
            {submitting ? "Posting…" : "Post call"}
          </Button>
        </div>
      </form>
    </main>
  );
}
