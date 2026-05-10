import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/image-upload";
import { CATEGORIES, type Category, categoryClass } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/works/new")({ component: NewWork });

const LICENSES = [
  { id: "cc_by", label: "CC BY — credit required" },
  { id: "portfolio_credit_only", label: "Portfolio + credit only" },
  { id: "rights_managed_externally", label: "Rights managed externally" },
  { id: "private", label: "Private (you only)" },
] as const;

function NewWork() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("visual");
  const [excerpt, setExcerpt] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [primaryUrl, setPrimaryUrl] = useState("");
  const [license, setLicense] = useState<typeof LICENSES[number]["id"]>("cc_by");
  const [submitting, setSubmitting] = useState(false);
  const [myProfile, setMyProfile] = useState<{ display_name: string | null; username: string | null } | null>(null);
  const [sourceType, setSourceType] = useState<"manual" | "workshop" | "collab_board">("manual");
  const [sourceWorkshopId, setSourceWorkshopId] = useState<string>("");
  const [sourceCollabId, setSourceCollabId] = useState<string>("");
  const [myWorkshops, setMyWorkshops] = useState<{ id: string; title: string }[]>([]);
  const [myCollabs, setMyCollabs] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("display_name,username").eq("id", user.id).maybeSingle()
      .then(({ data }) => setMyProfile(data));
    supabase.from("workshops").select("id,title").eq("host_user_id", user.id).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setMyWorkshops(data ?? []));
    supabase.from("collab_posts").select("id,title").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setMyCollabs(data ?? []));
  }, [user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) return toast.error("Title is required");
    setSubmitting(true);

    const { data: work, error } = await supabase
      .from("works")
      .insert({
        title: title.trim(),
        slug: "", // trigger generates
        category,
        excerpt: excerpt || null,
        description: description || null,
        cover_url: coverUrl,
        primary_url: primaryUrl || null,
        source_type: sourceType,
        source_workshop_id: sourceType === "workshop" && sourceWorkshopId ? sourceWorkshopId : null,
        source_collab_post_id: sourceType === "collab_board" && sourceCollabId ? sourceCollabId : null,
        license_type: license,
        status: "published",
        visibility: "public",
        created_by: user.id,
      })
      .select("id,slug")
      .single();

    if (error || !work) {
      setSubmitting(false);
      return toast.error(error?.message ?? "Failed to publish");
    }

    // Add self as the first credit (work_credits trigger bumps work_count)
    await supabase.from("work_credits").insert({
      work_id: work.id,
      user_id: user.id,
      role_label: "Creator",
      sort_order: 0,
    });

    setSubmitting(false);
    toast.success("Work published");
    navigate({ to: "/works/$slug", params: { slug: work.slug } });
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 md:py-14">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl text-ink">Publish a Work</h1>
        <p className="mt-1 text-ink-muted">
          Add something you've finished. Workshops you complete will publish here automatically too.
        </p>
      </motion.div>

      <form onSubmit={onSubmit} className="mt-8 space-y-7">
        <section className="space-y-2">
          <Label>Cover</Label>
          <ImageUpload value={coverUrl} onChange={setCoverUrl} bucket="work-covers" aspect="portrait" label="Upload a 4:5 cover image" />
        </section>

        <section className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" required maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What is it called?" />
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
          <Label htmlFor="excerpt">One-line excerpt</Label>
          <Input id="excerpt" maxLength={180} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="A short tagline." />
        </section>

        <section className="space-y-1.5">
          <Label htmlFor="desc">Description</Label>
          <Textarea id="desc" rows={6} maxLength={3000} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is it? Who is it for? How was it made?" />
        </section>

        <section className="space-y-1.5">
          <Label htmlFor="url">Primary URL (optional)</Label>
          <Input id="url" type="url" value={primaryUrl} onChange={(e) => setPrimaryUrl(e.target.value)} placeholder="https://…" />
          <p className="text-xs text-ink-muted">Where the original lives — Vimeo, Bandcamp, GitHub, your site.</p>
        </section>

        <section className="space-y-1.5">
          <Label htmlFor="lic">License</Label>
          <select id="lic" value={license} onChange={(e) => setLicense(e.target.value as typeof license)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
            {LICENSES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
        </section>

        <div className="rounded-2xl border border-border bg-surface p-4 text-sm text-ink-muted">
          You'll be credited as <span className="text-ink">{myProfile?.display_name || myProfile?.username || "yourself"}</span>.
          Co-creator credits open up when you publish through a Workshop.
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => navigate({ to: "/" })}>Cancel</Button>
          <Button type="submit" disabled={submitting} className="rounded-full">{submitting ? "Publishing…" : "Publish Work"}</Button>
        </div>
      </form>
    </main>
  );
}
