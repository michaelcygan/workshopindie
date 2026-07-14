import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Plus, Trash2, Info } from "lucide-react";
import { createCollaborativeWork } from "@/lib/works.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/works/collab/new")({
  component: NewCollaborativeWork,
  head: () => ({
    meta: [
      { title: "Start a collaborative Work — Workshop" },
      { name: "description", content: "Create a Work, set the splits and rights, and start collaborating." },
    ],
  }),
});

type Split = { user_id: string | null; role: string; name: string; pct: number };

const CATEGORIES = [
  "film", "music", "writing", "build", "visual",
  "critique", "business", "mentorship", "coworking",
] as const;

function NewCollaborativeWork() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const createFn = useServerFn(createCollaborativeWork);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<typeof CATEGORIES[number]>("music");
  const [visibility, setVisibility] = useState<"private" | "public" | "invite_only">("private");
  const [license, setLicense] = useState<"cc_by" | "rights_managed_externally" | "portfolio_credit_only" | "private">("portfolio_credit_only");
  const [licenseCustom, setLicenseCustom] = useState("");
  const [creditTemplate, setCreditTemplate] = useState("");
  const [commercialUse, setCommercialUse] = useState<"yes" | "no" | "negotiable">("negotiable");
  const [splits, setSplits] = useState<Split[]>([
    { user_id: null, role: "Owner", name: "Me", pct: 100 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const total = splits.reduce((s, x) => s + (Number(x.pct) || 0), 0);

  if (!user) {
    return (
      <div className="container mx-auto p-8 max-w-md">
        <h1 className="text-2xl font-semibold mb-2">Sign in to post to your Gallery</h1>
        <Button asChild><Link to="/login">Sign in</Link></Button>
      </div>
    );
  }

  function addSplit() {
    setSplits((s) => [...s, { user_id: null, role: "Collaborator", name: "", pct: 0 }]);
  }
  function updateSplit(i: number, patch: Partial<Split>) {
    setSplits((s) => s.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  }
  function removeSplit(i: number) {
    setSplits((s) => s.filter((_, idx) => idx !== i));
  }

  async function submit() {
    if (!title.trim()) { toast.error("Add a title"); return; }
    if (Math.round(total) !== 100) { toast.error(`Splits must total 100% (currently ${total.toFixed(0)}%)`); return; }
    if (!agreed) { toast.error("You need to agree to the deal memo to continue"); return; }
    setSubmitting(true);
    try {
      // Ensure owner split has user_id set
      const splitsWithOwner = splits.map((s) =>
        s.user_id ? s : { ...s, user_id: user!.id }
      );
      const res = await createFn({
        data: {
          title: title.trim(),
          description: description.trim() || null,
          category,
          visibility,
          license,
          license_custom: license === "portfolio_credit_only" && licenseCustom.trim() ? licenseCustom.trim() : null,
          credit_template: creditTemplate.trim() || null,
          commercial_use: commercialUse,
          splits: splitsWithOwner,
        },
      });
      toast.success("Work created");
      navigate({ to: "/works/$slug", params: { slug: res.slug } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-1">Start a collaborative Work</h1>
      <p className="text-sm text-muted-foreground mb-6">
        One screen. Set the basics, lock in the rights and splits, and you're in.
        You can change anything later — every change is recorded.
      </p>

      <div className="space-y-5">
        {/* Basics */}
        <Card className="p-4 space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Late Night Sessions" maxLength={200} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as typeof CATEGORIES[number])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Short description (optional)</Label>
            <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} placeholder="What's the project? Anything useful for a collaborator to know up front." />
          </div>
        </Card>

        {/* Visibility */}
        <Card className="p-4">
          <Label className="mb-3 block">Visibility</Label>
          <RadioGroup value={visibility} onValueChange={(v) => setVisibility(v as typeof visibility)}>
            <div className="flex items-start gap-2 py-1">
              <RadioGroupItem value="private" id="vis-private" className="mt-0.5" />
              <label htmlFor="vis-private" className="text-sm cursor-pointer">
                <span className="font-medium">Private</span>{" "}
                <span className="text-muted-foreground">— Only collaborators can see anything. Recommended default.</span>
              </label>
            </div>
            <div className="flex items-start gap-2 py-1">
              <RadioGroupItem value="public" id="vis-public" className="mt-0.5" />
              <label htmlFor="vis-public" className="text-sm cursor-pointer">
                <span className="font-medium">Open to applicants</span>{" "}
                <span className="text-muted-foreground">— Listed publicly. Anyone can request to join; you approve.</span>
              </label>
            </div>
            <div className="flex items-start gap-2 py-1">
              <RadioGroupItem value="invite_only" id="vis-invite" className="mt-0.5" />
              <label htmlFor="vis-invite" className="text-sm cursor-pointer">
                <span className="font-medium">Invite link only</span>{" "}
                <span className="text-muted-foreground">— Hidden from discovery. Share an invite link to bring people in.</span>
              </label>
            </div>
          </RadioGroup>
        </Card>

        {/* Rights */}
        <Card className="p-4 space-y-4">
          <div>
            <Label className="mb-2 block flex items-center gap-1.5">Rights <Info className="size-3.5 text-muted-foreground" /></Label>
            <p className="-mt-1 mb-2 text-xs text-muted-foreground">
              You're leaving the Workshop's default CC BY-SA. Pick the terms you and your co-creators want.
            </p>
            <Select value={license} onValueChange={(v) => setLicense(v as typeof license)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cc_by">CC BY — Free to share with credit</SelectItem>
                <SelectItem value="rights_managed_externally">Rights managed externally — Label or publisher controls</SelectItem>
                <SelectItem value="portfolio_credit_only">Portfolio / credit only — Show in portfolios, no distribution</SelectItem>
                <SelectItem value="private">Private / All rights reserved</SelectItem>
              </SelectContent>
            </Select>
            {license === "portfolio_credit_only" && (
              <Textarea
                rows={2}
                value={licenseCustom}
                onChange={(e) => setLicenseCustom(e.target.value)}
                placeholder="Optional: custom terms in your own words"
                className="mt-2"
              />
            )}
          </div>
          <div>
            <Label>Credit template (optional)</Label>
            <Input value={creditTemplate} onChange={(e) => setCreditTemplate(e.target.value)} placeholder='e.g. "Music by {role:composer}, Mixed by {role:engineer}"' />
          </div>
          <div>
            <Label className="mb-2 block">Commercial use</Label>
            <RadioGroup value={commercialUse} onValueChange={(v) => setCommercialUse(v as typeof commercialUse)} className="flex gap-4">
              <div className="flex items-center gap-1.5"><RadioGroupItem value="yes" id="c-yes" /><label htmlFor="c-yes" className="text-sm cursor-pointer">Yes</label></div>
              <div className="flex items-center gap-1.5"><RadioGroupItem value="no" id="c-no" /><label htmlFor="c-no" className="text-sm cursor-pointer">No</label></div>
              <div className="flex items-center gap-1.5"><RadioGroupItem value="negotiable" id="c-neg" /><label htmlFor="c-neg" className="text-sm cursor-pointer">Negotiable</label></div>
            </RadioGroup>
          </div>
        </Card>

        {/* Splits */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label>Splits</Label>
            <span className={`text-xs ${Math.round(total) === 100 ? "text-muted-foreground" : "text-destructive font-medium"}`}>
              Total: {total.toFixed(0)}%
            </span>
          </div>
          <div className="space-y-2">
            {splits.map((s, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_80px_auto] gap-2 items-center">
                <Input
                  placeholder="Name"
                  value={s.name}
                  onChange={(e) => updateSplit(i, { name: e.target.value })}
                />
                <Input
                  placeholder="Role (e.g. Producer)"
                  value={s.role}
                  onChange={(e) => updateSplit(i, { role: e.target.value })}
                />
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={s.pct}
                  onChange={(e) => updateSplit(i, { pct: Number(e.target.value) })}
                />
                {splits.length > 1 ? (
                  <Button variant="ghost" size="icon" onClick={() => removeSplit(i)}>
                    <Trash2 className="size-4" />
                  </Button>
                ) : <div />}
              </div>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={addSplit}>
            <Plus className="size-3.5 mr-1.5" /> Add role
          </Button>
          <p className="text-xs text-muted-foreground">
            Anyone who joins later signs the current splits. To change them, propose an amendment and majority signs off.
          </p>
        </Card>

        {/* Sign */}
        <Card className="p-4">
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I agree to these terms. This snapshot is signed and recorded.
              Every collaborator who joins later signs the active version.
            </span>
          </label>
        </Card>

        <Button onClick={submit} disabled={submitting || !agreed} size="lg" className="w-full">
          {submitting && <Loader2 className="size-4 mr-2 animate-spin" />}
          Create Work
        </Button>
      </div>
    </div>
  );
}
