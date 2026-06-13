/**
 * Persona Tabs — multi-user shell around the Recorder.
 *
 * Solo: a private "Capture a take" instance that nobody else sees.
 * Persona: a named, shared instance. The owner invites room members; each
 * member runs their own RecorderEngine for their own sources. Records can be
 * triggered in sync (owner-start) and collaborator files are mirrored into
 * the persona owner's drive.
 *
 * Each tab body is kept mounted (hidden when inactive) so an in-progress
 * take doesn't get torn down when the user switches tabs.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, X, UserPlus, Lock, Users, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { WorkshopRecorder, type PersonaContext } from "@/components/workshop-recorder";
import type { useMediaRoom } from "@/hooks/use-media-room";
import {
  createPersona,
  invitePersonaMember,
  removePersona,
  setPersonaMemberState,
} from "@/lib/recorder-personas.functions";

type Scope =
  | { kind: "instant"; roomId: string }
  | { kind: "persistent"; workshopId: string };

type PersonaRow = {
  id: string;
  name: string;
  owner_user_id: string;
  control_mode: "owner_start" | "self";
  privacy: "shared" | "private";
  room_id: string | null;
  workshop_id: string | null;
};

type MemberRow = { persona_id: string; user_id: string; state: string };

export function PersonaRecorderTabs({
  scope,
  media,
}: {
  scope: Scope;
  media?: ReturnType<typeof useMediaRoom>;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const create = useServerFn(createPersona);
  const remove = useServerFn(removePersona);
  const invite = useServerFn(invitePersonaMember);
  const setState = useServerFn(setPersonaMemberState);
  const [active, setActive] = useState<string>("solo"); // "solo" or persona id
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const scopeKey = scope.kind === "instant" ? scope.roomId : scope.workshopId;

  // Fetch personas in this scope + my memberships.
  const personasQ = useQuery({
    queryKey: ["recorder-personas", scope.kind, scopeKey],
    enabled: !!user,
    queryFn: async (): Promise<PersonaRow[]> => {
      const col = scope.kind === "instant" ? "room_id" : "workshop_id";
      const { data } = await (supabase.from("recorder_personas") as any)
        .select("id,name,owner_user_id,control_mode,privacy,room_id,workshop_id")
        .eq(col, scopeKey)
        .order("created_at", { ascending: true });
      return (data ?? []) as PersonaRow[];
    },
  });

  const membersQ = useQuery({
    queryKey: ["recorder-persona-members", scope.kind, scopeKey],
    enabled: !!user && (personasQ.data?.length ?? 0) > 0,
    queryFn: async (): Promise<MemberRow[]> => {
      const ids = (personasQ.data ?? []).map((p) => p.id);
      if (ids.length === 0) return [];
      const { data } = await (supabase.from("recorder_persona_members") as any)
        .select("persona_id,user_id,state")
        .in("persona_id", ids);
      return (data ?? []) as MemberRow[];
    },
  });

  // Realtime: any persona/member change in this scope refreshes both.
  useEffect(() => {
    if (!user || !scopeKey) return;
    const ch = supabase
      .channel(`personas:${scope.kind}:${scopeKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "recorder_personas" }, () => {
        qc.invalidateQueries({ queryKey: ["recorder-personas", scope.kind, scopeKey] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "recorder_persona_members" }, () => {
        qc.invalidateQueries({ queryKey: ["recorder-persona-members", scope.kind, scopeKey] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, scope.kind, scopeKey, qc]);

  // Visible personas: ones I own + ones I'm invited to.
  const visiblePersonas = useMemo<PersonaRow[]>(() => {
    if (!user) return [];
    const all = personasQ.data ?? [];
    const members = membersQ.data ?? [];
    return all.filter((p) =>
      p.owner_user_id === user.id ||
      members.some((m) => m.persona_id === p.id && m.user_id === user.id && m.state !== "declined" && m.state !== "left"),
    );
  }, [personasQ.data, membersQ.data, user]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    try {
      const res = await create({
        data: {
          scope: scope.kind === "instant"
            ? { kind: "instant", roomId: scope.roomId }
            : { kind: "workshop", workshopId: scope.workshopId },
          name,
          controlMode: "owner_start",
          privacy: "shared",
        },
      });
      setNewName("");
      setCreating(false);
      setActive(res.id);
      qc.invalidateQueries({ queryKey: ["recorder-personas", scope.kind, scopeKey] });
      toast.success(`Persona "${name}" created`);
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't create persona");
    }
  }

  async function handleRemove(personaId: string) {
    if (!window.confirm("Remove this persona for everyone?")) return;
    try {
      await remove({ data: { personaId } });
      if (active === personaId) setActive("solo");
      qc.invalidateQueries({ queryKey: ["recorder-personas", scope.kind, scopeKey] });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't remove");
    }
  }

  async function handleLeave(personaId: string) {
    try {
      await setState({ data: { personaId, state: "left" } });
      if (active === personaId) setActive("solo");
      qc.invalidateQueries({ queryKey: ["recorder-persona-members", scope.kind, scopeKey] });
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't leave");
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        <TabPill
          active={active === "solo"}
          onClick={() => setActive("solo")}
          icon={<Lock className="h-3 w-3" />}
          label="Solo"
        />
        {visiblePersonas.map((p) => {
          const isOwner = p.owner_user_id === user.id;
          return (
            <TabPill
              key={p.id}
              active={active === p.id}
              onClick={() => setActive(p.id)}
              icon={<Circle className="h-2.5 w-2.5 fill-current text-primary" />}
              label={p.name}
              detail={isOwner ? "owner" : undefined}
              onClose={isOwner ? () => handleRemove(p.id) : () => handleLeave(p.id)}
            />
          );
        })}
        {creating ? (
          <div className="inline-flex items-center gap-1 rounded-full border border-border bg-surface pl-2 pr-1 py-1">
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") { setCreating(false); setNewName(""); }
              }}
              placeholder="e.g. Producer A"
              className="h-6 w-32 border-0 bg-transparent px-1 text-xs focus-visible:ring-0"
            />
            <Button size="sm" onClick={handleCreate} className="h-6 rounded-full px-3 text-[11px]">Add</Button>
          </div>
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1 text-xs text-ink-muted hover:bg-muted hover:text-ink"
          >
            <Plus className="h-3 w-3" /> Persona
          </button>
        )}
      </div>

      {/* Bodies — all mounted, only active is visible so engines persist across tab switches. */}
      <div>
        <div className={active === "solo" ? "" : "hidden"}>
          <WorkshopRecorder scope={scope} media={media} />
        </div>
        {visiblePersonas.map((p) => {
          const ctx: PersonaContext = {
            id: p.id,
            name: p.name,
            ownerUserId: p.owner_user_id,
            controlMode: p.control_mode,
          };
          const isOwner = p.owner_user_id === user.id;
          const personaMembers = (membersQ.data ?? []).filter((m) => m.persona_id === p.id);
          return (
            <div key={p.id} className={active === p.id ? "" : "hidden"}>
              <PersonaHeader
                persona={p}
                members={personaMembers}
                isOwner={isOwner}
                peers={media?.peers ?? []}
                onInvite={async (userId) => {
                  try {
                    await invite({ data: { personaId: p.id, userId } });
                    qc.invalidateQueries({ queryKey: ["recorder-persona-members", scope.kind, scopeKey] });
                    toast.success("Invited");
                  } catch (e: any) {
                    toast.error(e?.message ?? "Couldn't invite");
                  }
                }}
              />
              <WorkshopRecorder scope={scope} media={media} persona={ctx} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TabPill({
  active, onClick, icon, label, detail, onClose,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  detail?: string;
  onClose?: () => void;
}) {
  return (
    <div
      className={`inline-flex items-center rounded-full text-xs transition ${
        active ? "bg-ink text-background" : "border border-border bg-surface text-ink-soft hover:bg-muted"
      }`}
    >
      <button onClick={onClick} className="inline-flex items-center gap-1.5 rounded-full pl-3 pr-2 py-1">
        {icon}
        <span className="font-medium">{label}</span>
        {detail && (
          <span className={`ml-1 text-[9px] uppercase tracking-wider ${active ? "text-background/70" : "text-ink-muted"}`}>
            {detail}
          </span>
        )}
      </button>
      {onClose && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label="Close"
          className={`mr-1 inline-flex h-5 w-5 items-center justify-center rounded-full transition ${
            active ? "text-background/70 hover:bg-background/15" : "text-ink-muted hover:bg-background hover:text-ink"
          }`}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function PersonaHeader({
  persona, members, isOwner, peers, onInvite,
}: {
  persona: PersonaRow;
  members: MemberRow[];
  isOwner: boolean;
  peers: Array<{ userId: string }>;
  onInvite: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const memberIds = new Set(members.map((m) => m.user_id));
  const invitable = peers.filter((p) => p.userId !== persona.owner_user_id && !memberIds.has(p.userId));
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface-2 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[11px] text-ink-soft">
        <Users className="h-3 w-3" />
        <span>{members.length || 1} member{(members.length || 1) === 1 ? "" : "s"}</span>
      </div>
      <div className="flex -space-x-1.5">
        {members.slice(0, 5).map((m) => (
          <div key={m.user_id}
            title={`${m.user_id.slice(0, 6)} · ${m.state}`}
            className={`h-5 w-5 rounded-full border border-surface text-[9px] font-mono uppercase grid place-items-center ${
              m.state === "recording" ? "bg-destructive text-bg" : m.state === "ready" ? "bg-primary/20 text-ink" : "bg-muted text-ink-muted"
            }`}>
            {m.user_id.slice(0, 2)}
          </div>
        ))}
      </div>
      {isOwner && (
        <div className="relative ml-auto">
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-[11px] text-ink hover:bg-muted"
          >
            <UserPlus className="h-3 w-3" /> Invite
          </button>
          {open && (
            <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-xl border border-border bg-surface p-1 shadow-lift">
              {invitable.length === 0 ? (
                <div className="px-2 py-2 text-xs text-ink-muted">No one else in the room yet.</div>
              ) : (
                invitable.map((p) => (
                  <button
                    key={p.userId}
                    onClick={() => { onInvite(p.userId); setOpen(false); }}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs text-ink hover:bg-muted"
                  >
                    <span className="font-mono">{p.userId.slice(0, 8)}</span>
                    <span className="text-ink-muted">invite</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
      {!isOwner && (
        <span className="ml-auto text-[10px] uppercase tracking-wider text-ink-muted">
          Producer-led
        </span>
      )}
    </div>
  );
}
