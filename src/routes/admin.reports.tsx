import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Eye, EyeOff, Check, X, Loader2, ExternalLink } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsQueue,
});

type Report = {
  id: string;
  reporter_user_id: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  description: string | null;
  status: "open" | "reviewed" | "dismissed" | "action_taken";
  created_at: string;
};

const TABS: { value: Report["status"]; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "reviewed", label: "Reviewed" },
  { value: "action_taken", label: "Action taken" },
  { value: "dismissed", label: "Dismissed" },
];

function entityLink(type: string, id: string): string | null {
  // We don't have slugs cached; admin opens detail in raw form via the entity type lookup below.
  return null;
}

function ReportsQueue() {
  const [tab, setTab] = useState<Report["status"]>("open");
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("reports")
      .select("*")
      .eq("status", tab)
      .order("created_at", { ascending: false })
      .limit(100);
    setReports((data ?? []) as Report[]);
    setLoading(false);
  }

  useEffect(() => { load(); }, [tab]);

  async function setStatus(id: string, status: Report["status"]) {
    setActing(id);
    const { error } = await supabase.from("reports").update({ status }).eq("id", id);
    setActing(null);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked ${status.replace("_", " ")}`);
    setReports((rs) => rs.filter((r) => r.id !== id));
  }

  async function hideEntity(r: Report) {
    setActing(r.id);
    let error: any = null;
    if (r.entity_type === "comment") {
      ({ error } = await supabase.from("comments").update({ hidden: true }).eq("id", r.entity_id));
    } else if (r.entity_type === "work") {
      ({ error } = await supabase.from("works").update({ visibility: "private" }).eq("id", r.entity_id));
    } else if (r.entity_type === "workshop") {
      ({ error } = await supabase.from("workshops").update({ visibility: "private" }).eq("id", r.entity_id));
    } else if (r.entity_type === "collab_post") {
      ({ error } = await supabase.from("collab_posts").update({ status: "removed" }).eq("id", r.entity_id));
    } else {
      toast.message("No hide action available for this entity type.");
      setActing(null);
      return;
    }
    if (error) { toast.error(error.message); setActing(null); return; }
    await supabase.from("reports").update({ status: "action_taken" }).eq("id", r.id);
    setReports((rs) => rs.filter((x) => x.id !== r.id));
    setActing(null);
    toast.success("Hidden + report closed");
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`rounded-full px-3 py-1.5 text-sm transition ${
              tab === t.value
                ? "bg-ink text-background"
                : "border border-border bg-surface text-ink-soft hover:bg-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-ink-muted"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-ink-muted">
          Nothing in this queue.
        </div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="rounded-full">{r.entity_type}</Badge>
                    <Badge className="rounded-full bg-coral/10 text-coral hover:bg-coral/10">{r.reason}</Badge>
                    <span className="text-xs text-ink-muted">{new Date(r.created_at).toLocaleString()}</span>
                  </div>
                  {r.description && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{r.description}</p>
                  )}
                  <p className="mt-2 break-all text-xs text-ink-muted">
                    entity: <code className="rounded bg-muted px-1 py-0.5">{r.entity_id}</code>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {r.status === "open" && (
                    <>
                      <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={() => hideEntity(r)} disabled={acting === r.id}>
                        <EyeOff className="h-3.5 w-3.5" /> Hide
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={() => setStatus(r.id, "reviewed")} disabled={acting === r.id}>
                        <Eye className="h-3.5 w-3.5" /> Mark reviewed
                      </Button>
                      <Button size="sm" variant="outline" className="rounded-full gap-1.5" onClick={() => setStatus(r.id, "dismissed")} disabled={acting === r.id}>
                        <X className="h-3.5 w-3.5" /> Dismiss
                      </Button>
                      <Button size="sm" className="rounded-full gap-1.5" onClick={() => setStatus(r.id, "action_taken")} disabled={acting === r.id}>
                        <Check className="h-3.5 w-3.5" /> Action taken
                      </Button>
                    </>
                  )}
                  {r.status !== "open" && (
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => setStatus(r.id, "open")}>Reopen</Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
