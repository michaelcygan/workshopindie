import { useEffect, useRef, useState } from "react";
import { Pencil, Pin, Plus, X, Check } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { setRoomNote } from "@/lib/host-room.functions";
import { RenderLinks } from "@/lib/render-links";

const MAX = 280;

type Props = { roomId: string };

type RoomNoteRow = {
  host_user_id: string | null;
  workshop_id: string | null;
  kind: string;
  status: string;
  note: string | null;
  note_updated_by: string | null;
};

export function RoomNoteBanner({ roomId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const save = useServerFn(setRoomNote);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: room } = useQuery({
    queryKey: ["room-note", roomId],
    enabled: !!roomId,
    refetchInterval: 8000,
    queryFn: async () => {
      const { data } = await supabase
        .from("instant_rooms")
        .select("host_user_id, workshop_id, kind, status, note, note_updated_by")
        .eq("id", roomId)
        .maybeSingle();
      return (data as RoomNoteRow | null) ?? null;
    },
  });

  // For workshop-paired rooms, the editor is the Workshop's host.
  const { data: workshopHostId } = useQuery({
    queryKey: ["room-note-ws-host", room?.workshop_id],
    enabled: !!room?.workshop_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("workshops")
        .select("host_user_id")
        .eq("id", room!.workshop_id!)
        .maybeSingle();
      return (data?.host_user_id as string | null) ?? null;
    },
  });

  // Viewer present in the room? Used for No-Host editability.
  const { data: present = false } = useQuery({
    queryKey: ["room-note-present", roomId, user?.id],
    enabled: !!user && !!roomId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const { data } = await supabase
        .from("instant_presence")
        .select("user_id")
        .eq("room_id", roomId)
        .eq("user_id", user!.id)
        .gt("last_seen_at", cutoff)
        .maybeSingle();
      return !!data;
    },
  });

  const mut = useMutation({
    mutationFn: async (text: string | null) => save({ data: { roomId, text } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["room-note", roomId] }),
    onError: (e: any) => toast.error(e?.message ?? "Couldn't save"),
  });

  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      taRef.current.setSelectionRange(taRef.current.value.length, taRef.current.value.length);
    }
  }, [editing]);

  // Derived values (safe when room is still loading) — computed here so the
  // hooks below can depend on them without violating rules-of-hooks.
  const note = (room?.note ?? "").trim();
  const workshopHasHost = !!workshopHostId;
  const roomHasHost = !!room?.host_user_id;
  const canEdit =
    !!user && !!room &&
    (roomHasHost
      ? room.host_user_id === user.id
      : room.workshop_id
        ? workshopHasHost
          ? workshopHostId === user.id
          : present
        : room.kind === "lounge" && present);

  // Ambient nudge tooltip: 3.5s after mount, when empty + editable + not yet dismissed.
  const nudgeKey = `room-note-nudge:${roomId}`;
  const [showNudge, setShowNudge] = useState(false);
  useEffect(() => {
    if (!canEdit || note || editing) return;
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(nudgeKey)) return;
    const tShow = window.setTimeout(() => setShowNudge(true), 3500);
    const tHide = window.setTimeout(() => setShowNudge(false), 3500 + 12_000);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowNudge(false);
        window.localStorage.setItem(nudgeKey, "1");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(tShow);
      window.clearTimeout(tHide);
      window.removeEventListener("keydown", onKey);
    };
  }, [canEdit, note, editing, nudgeKey]);

  if (!room || room.status !== "active") return null;

  // Read-only viewer with no note → render nothing.
  if (!note && !canEdit) return null;


  function startEdit() {
    setDraft(note);
    setEditing(true);
  }

  async function commit() {
    const text = draft.trim();
    if (text === note) {
      setEditing(false);
      return;
    }
    await mut.mutateAsync(text.length === 0 ? null : text);
    setEditing(false);
  }


  function dismissNudge() {
    setShowNudge(false);
    if (typeof window !== "undefined") window.localStorage.setItem(nudgeKey, "1");
  }

  // Empty + can edit → "+" pill with ambient CC whisper
  if (!note && canEdit && !editing) {
    return (
      <div className="mx-3 mt-3 sm:mx-6">
        <div className="relative inline-flex flex-wrap items-center gap-2">
          {showNudge && (
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-6 -z-10 rounded-full [background:radial-gradient(60%_70%_at_30%_50%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_75%)]"
            />
          )}
          <button
            type="button"
            onClick={() => {
              dismissNudge();
              startEdit();
            }}
            className="group inline-flex items-center gap-1.5 rounded-full border border-dashed border-border bg-surface-2/40 px-3 py-1.5 text-xs text-ink-muted hover:bg-surface hover:text-ink hover:ring-1 hover:ring-primary/15 hover:shadow-soft transition"
          >
            <Pin className="h-3.5 w-3.5 text-primary/70" />
            <Plus className="h-3 w-3 -ml-0.5" />
            Pin a welcome for new arrivals
          </button>
          <span className="text-[10px] uppercase tracking-[0.16em] text-ink-muted/70">· CC BY-SA</span>
          {showNudge && (
            <div
              role="status"
              className="absolute left-0 top-full z-10 mt-2 max-w-xs rounded-2xl border border-border bg-surface-2/95 px-3 py-2 text-[11px] text-ink shadow-soft backdrop-blur"
            >
              <div className="flex items-start gap-2">
                <Pin className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
                <span className="leading-snug">
                  Pin a welcome message so new arrivals know what this room is about.
                </span>
                <button
                  type="button"
                  onClick={dismissNudge}
                  aria-label="Dismiss"
                  className="-mr-1 -mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-muted hover:text-ink"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-3 mt-3 rounded-2xl border border-border bg-surface-2/70 p-3 sm:mx-6">
      {editing ? (
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-muted"><Pin className="h-3 w-3 text-primary/70" /> Welcome pin</div>
            <textarea
              ref={taRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
                if (e.key === "Escape") { e.preventDefault(); setEditing(false); }
              }}
              rows={2}
              placeholder="What should new arrivals see when they drop in?"
              className="mt-1 w-full resize-none bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none"
            />
            <div className="mt-1 flex items-center justify-between">
              <span className="text-[10px] text-ink-muted">{MAX - draft.length} left · ⌘↵ to save</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-xs text-ink-muted hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={commit}
                  disabled={mut.isPending}
                  className="inline-flex h-7 items-center gap-1 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" /> Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="group flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-muted"><Pin className="h-3 w-3 text-primary/70" /> Welcome pin</div>
            <p className="mt-0.5 whitespace-pre-wrap text-sm text-ink"><RenderLinks text={note} /></p>
          </div>
          {canEdit && (
            <div className="flex shrink-0 items-center gap-1 opacity-60 transition group-hover:opacity-100">
              <button
                type="button"
                onClick={startEdit}
                aria-label="Edit note"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-muted hover:text-ink"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => mut.mutate(null)}
                aria-label="Clear note"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-muted hover:bg-muted hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
