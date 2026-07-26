import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Reorder, useDragControls } from "framer-motion";
import {
  Check,
  Circle,
  Clock,
  GripVertical,
  ListTodo,
  MoreHorizontal,
  Plus,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  type CollabTask,
  type CollabTaskStatus,
  createCollabTask,
  deleteCollabTask,
  listCollabTasks,
  reorderCollabTasks,
  updateCollabTask,
} from "@/lib/collab-tasks.functions";

const STATUS_LABEL: Record<CollabTaskStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

const STATUS_ORDER: CollabTaskStatus[] = ["todo", "in_progress", "done"];

function StatusIcon({ status, className }: { status: CollabTaskStatus; className?: string }) {
  if (status === "done") return <Check className={className} aria-hidden="true" />;
  if (status === "in_progress") return <Clock className={className} aria-hidden="true" />;
  return <Circle className={className} aria-hidden="true" />;
}

function statusPillClasses(status: CollabTaskStatus) {
  if (status === "done") return "bg-muted text-ink-muted";
  if (status === "in_progress") return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return "bg-muted/60 text-ink-soft";
}

export function useCollabTaskCount(collabPostId: string) {
  const { user } = useAuth();
  const listFn = useServerFn(listCollabTasks);
  const q = useQuery({
    queryKey: ["collab-tasks", collabPostId],
    queryFn: () => listFn({ data: { collabPostId } }),
    enabled: Boolean(user?.id && collabPostId),
    staleTime: 10_000,
  });
  const tasks = q.data ?? [];
  return {
    total: tasks.length,
    incomplete: tasks.filter((t) => t.status !== "done").length,
  };
}

export function CollabTasks({
  collabPostId,
  isOwner,
}: {
  collabPostId: string;
  ownerId?: string;
  isOwner: boolean;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const listFn = useServerFn(listCollabTasks);
  const createFn = useServerFn(createCollabTask);
  const updateFn = useServerFn(updateCollabTask);
  const deleteFn = useServerFn(deleteCollabTask);
  const reorderFn = useServerFn(reorderCollabTasks);

  const tasksQ = useQuery({
    queryKey: ["collab-tasks", collabPostId],
    queryFn: () => listFn({ data: { collabPostId } }),
    staleTime: 10_000,
  });

  const serverTasks: CollabTask[] = tasksQ.data ?? [];

  // Local ordering buffer so drag reorders feel instant and don't get thrashed
  // by realtime while a reorder is in flight.
  const [localOrder, setLocalOrder] = useState<CollabTask[] | null>(null);
  const reorderInFlight = useRef(false);

  useEffect(() => {
    if (!reorderInFlight.current) setLocalOrder(null);
  }, [serverTasks]);

  const tasks = localOrder ?? serverTasks;

  // Realtime with debounced invalidation.
  useEffect(() => {
    if (!collabPostId) return;
    const suffix =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2);
    let t: ReturnType<typeof setTimeout> | null = null;
    const ch = supabase
      .channel(`collab-tasks-${collabPostId}-${suffix}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "collab_tasks",
          filter: `collab_post_id=eq.${collabPostId}`,
        },
        () => {
          if (t) clearTimeout(t);
          t = setTimeout(() => {
            qc.invalidateQueries({ queryKey: ["collab-tasks", collabPostId] });
          }, 150);
        },
      )
      .subscribe();
    return () => {
      if (t) clearTimeout(t);
      supabase.removeChannel(ch);
    };
  }, [collabPostId, qc]);

  const totals = useMemo(() => {
    const total = tasks.length;
    const done = tasks.filter((t) => t.status === "done").length;
    return { total, done };
  }, [tasks]);

  /* ─── Mutations ───────────────────────────────────────────────────── */

  const [draft, setDraft] = useState("");
  const create = useMutation({
    mutationFn: async (title: string) => createFn({ data: { collabPostId, title } }),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["collab-tasks", collabPostId] });
    },
    onError: (e: Error) => toast.error(e.message || "Task couldn’t be added."),
  });

  const update = useMutation({
    mutationFn: (vars: { taskId: string; patch: { title?: string; status?: CollabTaskStatus } }) =>
      updateFn({ data: vars }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: ["collab-tasks", collabPostId] });
      const prev = qc.getQueryData<CollabTask[]>(["collab-tasks", collabPostId]);
      if (prev) {
        qc.setQueryData<CollabTask[]>(
          ["collab-tasks", collabPostId],
          prev.map((t) =>
            t.id === vars.taskId
              ? {
                  ...t,
                  ...(vars.patch.title !== undefined ? { title: vars.patch.title } : {}),
                  ...(vars.patch.status !== undefined
                    ? {
                        status: vars.patch.status,
                        completed_at:
                          vars.patch.status === "done"
                            ? new Date().toISOString()
                            : vars.patch.status !== undefined
                              ? null
                              : t.completed_at,
                      }
                    : {}),
                }
              : t,
          ),
        );
      }
      return { prev };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["collab-tasks", collabPostId], ctx.prev);
      toast.error(e.message || "Task couldn’t be updated.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["collab-tasks", collabPostId] }),
  });

  const remove = useMutation({
    mutationFn: (taskId: string) => deleteFn({ data: { taskId } }),
    onMutate: async (taskId) => {
      await qc.cancelQueries({ queryKey: ["collab-tasks", collabPostId] });
      const prev = qc.getQueryData<CollabTask[]>(["collab-tasks", collabPostId]);
      if (prev) {
        qc.setQueryData<CollabTask[]>(
          ["collab-tasks", collabPostId],
          prev.filter((t) => t.id !== taskId),
        );
      }
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["collab-tasks", collabPostId], ctx.prev);
      toast.error(e.message || "Couldn’t delete this task.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["collab-tasks", collabPostId] }),
  });

  const persistOrder = useMutation({
    mutationFn: (orderedTaskIds: string[]) =>
      reorderFn({ data: { collabPostId, orderedTaskIds } }),
    onMutate: () => {
      reorderInFlight.current = true;
    },
    onError: (e: Error) => {
      reorderInFlight.current = false;
      setLocalOrder(null);
      qc.invalidateQueries({ queryKey: ["collab-tasks", collabPostId] });
      toast.error(e.message || "Task order couldn’t be saved.");
    },
    onSuccess: () => {
      // Allow subsequent server data to overwrite local buffer.
      reorderInFlight.current = false;
      qc.invalidateQueries({ queryKey: ["collab-tasks", collabPostId] });
    },
  });

  function commitReorder(next: CollabTask[]) {
    setLocalOrder(next);
    persistOrder.mutate(next.map((t) => t.id));
  }

  function move(taskId: string, dir: -1 | 1) {
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx < 0) return;
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= tasks.length) return;
    const next = tasks.slice();
    const [item] = next.splice(idx, 1);
    next.splice(targetIdx, 0, item);
    commitReorder(next);
  }

  /* ─── Submit new task ─────────────────────────────────────────────── */

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || create.isPending) return;
    create.mutate(trimmed);
  }

  const [pendingDelete, setPendingDelete] = useState<CollabTask | null>(null);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2 min-w-0">
          <ListTodo className="h-4 w-4 text-ink-muted shrink-0" aria-hidden="true" />
          <h3 className="text-sm font-medium text-ink">Tasks</h3>
        </div>
        {totals.total > 0 && (
          <span className="text-xs text-ink-muted tabular-nums">
            {totals.done} of {totals.total} complete
          </span>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={submit} className="flex items-center gap-2 border-b border-border p-2 sm:p-3">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, 200))}
          placeholder="Add a task…"
          aria-label="Add a task"
          maxLength={200}
          className="min-h-[44px]"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit(e);
            }
          }}
        />
        <Button
          type="submit"
          size="sm"
          className="min-h-[44px] rounded-full gap-1"
          disabled={!draft.trim() || create.isPending}
        >
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>

      {/* List */}
      <div className="min-h-[120px] p-2 sm:p-3">
        {tasksQ.isLoading ? (
          <div className="space-y-2">
            <div className="h-12 animate-pulse rounded-xl bg-muted/40" />
            <div className="h-12 animate-pulse rounded-xl bg-muted/40" />
          </div>
        ) : tasksQ.isError ? (
          <div className="rounded-xl border border-border p-4 text-center text-sm text-ink-muted">
            <p>Tasks couldn’t load.</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 rounded-full"
              onClick={() => tasksQ.refetch()}
            >
              Try again
            </Button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm font-medium text-ink">Nothing on the list yet.</p>
            <p className="mt-1 text-xs text-ink-muted">Add the first next step for this Collab.</p>
          </div>
        ) : (
          <Reorder.Group
            axis="y"
            values={tasks}
            onReorder={(next) => setLocalOrder(next as CollabTask[])}
            className="space-y-1.5"
          >
            {tasks.map((task, idx) => (
              <TaskRow
                key={task.id}
                task={task}
                isFirst={idx === 0}
                isLast={idx === tasks.length - 1}
                canDelete={isOwner || task.created_by === user?.id}
                onStatusChange={(status) =>
                  update.mutate({ taskId: task.id, patch: { status } })
                }
                onRename={(title) =>
                  update.mutate({ taskId: task.id, patch: { title } })
                }
                onMoveUp={() => move(task.id, -1)}
                onMoveDown={() => move(task.id, 1)}
                onDragCommit={() => {
                  if (localOrder) commitReorder(localOrder);
                }}
                onRequestDelete={() => setPendingDelete(task)}
              />
            ))}
          </Reorder.Group>
        )}
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove it for everyone in the Collab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete) remove.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TaskRow({
  task,
  isFirst,
  isLast,
  canDelete,
  onStatusChange,
  onRename,
  onMoveUp,
  onMoveDown,
  onDragCommit,
  onRequestDelete,
}: {
  task: CollabTask;
  isFirst: boolean;
  isLast: boolean;
  canDelete: boolean;
  onStatusChange: (status: CollabTaskStatus) => void;
  onRename: (title: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragCommit: () => void;
  onRequestDelete: () => void;
}) {
  const controls = useDragControls();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  useEffect(() => {
    if (!editing) setDraft(task.title);
  }, [task.title, editing]);

  function commitEdit() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === task.title) {
      setEditing(false);
      setDraft(task.title);
      return;
    }
    onRename(trimmed);
    setEditing(false);
  }

  const done = task.status === "done";

  return (
    <Reorder.Item
      value={task}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragCommit}
      className={cn(
        "group flex items-start gap-2 rounded-xl border border-border bg-surface p-2 sm:p-2.5",
        done && "opacity-70",
      )}
    >
      <button
        type="button"
        onPointerDown={(e) => controls.start(e)}
        aria-label="Drag to reorder"
        className="mt-1 flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-ink-muted hover:text-ink active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 200))}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitEdit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setDraft(task.title);
                setEditing(false);
              }
            }}
            maxLength={200}
            className="min-h-[36px]"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={cn(
              "block w-full text-left text-sm text-ink",
              done && "line-through text-ink-muted",
            )}
          >
            {task.title}
          </button>
        )}

        {/* Status pill — visible under title on mobile, inline on desktop via flex on parent */}
        <div className="mt-1.5 flex items-center gap-1.5 sm:hidden">
          <StatusMenu status={task.status} onChange={onStatusChange} />
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-1.5">
        <StatusMenu status={task.status} onChange={onStatusChange} />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0 text-ink-muted"
            aria-label="Task actions"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => setEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" /> Edit
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isFirst} onClick={onMoveUp}>
            <ArrowUp className="mr-2 h-4 w-4" /> Move up
          </DropdownMenuItem>
          <DropdownMenuItem disabled={isLast} onClick={onMoveDown}>
            <ArrowDown className="mr-2 h-4 w-4" /> Move down
          </DropdownMenuItem>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={onRequestDelete}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </Reorder.Item>
  );
}

function StatusMenu({
  status,
  onChange,
}: {
  status: CollabTaskStatus;
  onChange: (next: CollabTaskStatus) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Status: ${STATUS_LABEL[status]}. Change status.`}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium min-h-[24px]",
            statusPillClasses(status),
          )}
        >
          <StatusIcon status={status} className="h-3 w-3" />
          {STATUS_LABEL[status]}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        {STATUS_ORDER.map((s) => (
          <DropdownMenuItem
            key={s}
            onClick={() => {
              if (s !== status) onChange(s);
            }}
            className={cn(s === status && "font-medium text-primary")}
          >
            <StatusIcon status={s} className="mr-2 h-3.5 w-3.5" />
            {STATUS_LABEL[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
