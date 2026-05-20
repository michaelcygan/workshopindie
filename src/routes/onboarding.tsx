import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, type Category, categoryClass } from "@/lib/categories";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding")({ component: Onboarding });

function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [cats, setCats] = useState<Category[]>([]);
  const [cities, setCities] = useState<{ id: string; name: string; country: string }[]>([]);
  const [cityId, setCityId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  useEffect(() => {
    supabase.from("cities").select("id,name,country").order("name").then(({ data }) => {
      if (data) setCities(data);
    });
  }, []);

  useEffect(() => {
    if (user) setName((user.user_metadata?.display_name as string) ?? "");
  }, [user]);

  const toggleCat = (c: Category) =>
    setCats((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!cityId) return toast.error("Please pick your home city — it powers your feed.");
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name,
        bio: bio || null,
        categories: cats,
        city_id: cityId,
        home_city_id: cityId,
        onboarded: true,
      })
      .eq("id", user.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome to Workshop");
    navigate({ to: "/" });
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl border border-border bg-surface p-8 shadow-soft">
        <h1 className="font-display text-3xl text-ink">Set up your studio</h1>
        <p className="mt-1 text-sm text-ink-muted">Tell us how to credit you. You can change all of this later.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            <p className="text-xs text-ink-muted">You can claim your public @handle later from your profile.</p>
          </div>

          <div className="space-y-1.5">
            <Label>City (optional)</Label>
            <select
              value={cityId}
              onChange={(e) => setCityId(e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">— Select city —</option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>{c.name}, {c.country}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>What do you make?</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => toggleCat(c.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition",
                    cats.includes(c.id)
                      ? cn("border-transparent", categoryClass(c.id))
                      : "border-border bg-surface text-ink-soft hover:bg-muted",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bio">Short bio (optional)</Label>
            <Textarea id="bio" rows={3} maxLength={280} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="One line about your work." />
          </div>

          <Button type="submit" className="w-full rounded-full" disabled={saving}>
            {saving ? "Saving…" : "Enter Workshop"}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
