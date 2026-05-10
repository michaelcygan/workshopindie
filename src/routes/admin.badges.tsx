import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CreatorBadge } from "@/components/creator-badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Search } from "lucide-react";

export const Route = createFileRoute("/admin/badges")({
  component: BadgesAdmin,
});

const STATUSES = ["standard", "founding_creator", "city_host", "verified_creator", "admin"] as const;
type Status = typeof STATUSES[number];

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  creator_status: Status;
  avatar_url: string | null;
};

function BadgesAdmin() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  async function search() {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("id,username,display_name,creator_status,avatar_url")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .limit(25);
    setResults((data ?? []) as Profile[]);
    setLoading(false);
  }

  async function setStatus(p: Profile, status: Status) {
    setUpdating(p.id);
    const { error } = await supabase.from("profiles").update({ creator_status: status }).eq("id", p.id);
    setUpdating(null);
    if (error) { toast.error(error.message); return; }
    setResults((rs) => rs.map((r) => r.id === p.id ? { ...r, creator_status: status } : r));
    toast.success(`Set ${p.display_name ?? p.username ?? "user"} → ${status.replace("_", " ")}`);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <Label className="text-sm">Find a creator</Label>
        <div className="mt-2 flex gap-2">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Username or display name…"
            className="rounded-full"
          />
          <Button className="rounded-full gap-1.5" onClick={search} disabled={loading}>
            <Search className="h-4 w-4" /> Search
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10 text-ink-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : results.length > 0 ? (
        <ul className="space-y-2">
          {results.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
              <div className="flex items-center gap-3">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted" />
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-ink">{p.display_name ?? "Unnamed"}</span>
                    <CreatorBadge status={p.creator_status} />
                  </div>
                  {p.username && <div className="text-xs text-ink-muted">@{p.username}</div>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Select value={p.creator_status} onValueChange={(v) => setStatus(p, v as Status)} disabled={updating === p.id}>
                  <SelectTrigger className="w-48 rounded-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-ink-muted">
          Search by name or username to grant Founding Creator, City Host, Verified, or Admin badges.
        </div>
      )}
    </div>
  );
}
