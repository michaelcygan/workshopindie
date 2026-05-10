import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, type Category, categoryClass } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/instant/new")({ component: NewInstant });

function NewInstant() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [cityId, setCityId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { if (!loading && !user) navigate({ to: "/login" }); }, [user, loading, navigate]);

  const { data: cities } = useQuery({
    queryKey: ["cities"],
    queryFn: async () => {
      const { data } = await supabase.from("cities").select("id,name").order("name").limit(200);
      return data ?? [];
    },
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!title.trim()) return toast.error("Give your room a title");
    setSubmitting(true);
    const { data, error } = await supabase.from("instant_rooms").insert({
      title: title.trim(),
      category: category || null,
      city_id: cityId || null,
      status: "active",
    }).select("id").single();
    if (error || !data) { setSubmitting(false); return toast.error(error?.message ?? "Couldn't create room"); }
    setSubmitting(false);
    navigate({ to: "/instant/$id", params: { id: data.id } });
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-10 md:py-14">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-4xl text-ink">Spawn a room</h1>
        <p className="mt-1 text-ink-muted">Lightweight and ephemeral. Messages disappear in 24 hours.</p>
      </motion.div>

      <form onSubmit={onSubmit} className="mt-8 space-y-6">
        <section className="space-y-1.5">
          <Label htmlFor="title">Title</Label>
          <Input id="title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Anyone scoring a short film tonight?" />
        </section>

        <section className="space-y-2">
          <Label>Category (optional)</Label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setCategory("")}
              className={cn("rounded-full border px-3 py-1.5 text-sm transition",
                category === "" ? "border-transparent bg-ink text-background" : "border-border bg-surface text-ink-soft hover:bg-muted")}>
              Any
            </button>
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
          <Label htmlFor="city">City (optional)</Label>
          <select id="city" value={cityId} onChange={(e) => setCityId(e.target.value)}
            className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm">
            <option value="">Anywhere</option>
            {cities?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </section>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => navigate({ to: "/instant" })}>Cancel</Button>
          <Button type="submit" disabled={submitting} className="rounded-full">{submitting ? "Spawning…" : "Spawn"}</Button>
        </div>
      </form>
    </main>
  );
}
