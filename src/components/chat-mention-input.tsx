import { useMemo, useRef, useState } from "react";
import { Calendar, FileText, Megaphone, Send, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MentionPopover } from "@/components/mention-popover";
import { GroupPeek } from "@/components/group-peek";
import { EventPeek } from "@/components/event-peek";
import { BlogPostPeek } from "@/components/blog-post-peek";
import type { MentionSuggestion } from "@/lib/mention-suggestions";

export type MentionCandidate = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

/**
 * Chat composer with `@handle` typeahead. Suggests:
 *  - People (room participants first, then global handle search)
 *  - Your Collabs (open collab_posts you own)
 *  - Groups (yours first, then public name search)
 *  - Upcoming Events
 *
 * User picks insert `@username `; the other kinds insert markdown-style
 * internal links (e.g. `[Title](/collab/slug) `) that MessageBody then
 * renders as chips + hover peeks.
 */
export function ChatMentionInput({
  draft,
  setDraft,
  onSubmit,
  sending,
  placeholder,
  participants,
  disabled,
  className,
  tone = "light",
  leadingAction,
}: {
  draft: string;
  setDraft: (s: string) => void;
  onSubmit: (mentions: string[]) => void;
  sending: boolean;
  placeholder: string;
  participants: MentionCandidate[];
  disabled?: boolean;
  className?: string;
  tone?: "light" | "dark";
  /** Optional control rendered to the left of the textarea (e.g. "+ Tool"). */
  leadingAction?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [tokenStart, setTokenStart] = useState<number | null>(null);

  // Recompute mention token under cursor when draft/selection changes.
  function syncToken(value: string, caret: number) {
    const upto = value.slice(0, caret);
    const m = /(?:^|\s)@([A-Za-z0-9_]{0,30})$/.exec(upto);
    if (m) {
      setTokenStart(caret - m[1].length - 1); // index of '@'
      setQuery(m[1].toLowerCase());
      setOpen(true);
    } else {
      setTokenStart(null);
      setOpen(false);
    }
  }

  // Room participants become "extra users" that show ahead of the global
  // profile search, without a network round-trip.
  const extraUsers: MentionSuggestion[] = useMemo(
    () =>
      participants
        .filter((p) => p.username)
        .map((p) => ({
          kind: "user" as const,
          id: p.user_id,
          label: p.display_name || (p.username as string),
          sublabel: `@${p.username}`,
          avatar: p.avatar_url,
          insert: `@${p.username} `,
        })),
    [participants],
  );

  function insertSuggestion(s: MentionSuggestion) {
    if (tokenStart === null) return;
    const input = inputRef.current;
    const caret = input?.selectionStart ?? draft.length;
    const before = draft.slice(0, tokenStart);
    const after = draft.slice(caret);
    // For user picks we replace the `@` and the partial handle with the
    // full `@handle `. For collab/group/event picks the `@` is discarded
    // and replaced with the markdown link.
    const next = before + s.insert + after;
    setDraft(next);
    setOpen(false);
    setTokenStart(null);
    requestAnimationFrame(() => {
      const pos = (before + s.insert).length;
      input?.focus();
      input?.setSelectionRange(pos, pos);
    });
  }

  function extractMentionIds(text: string): string[] {
    const out = new Set<string>();
    const re = /(?:^|\s)@([A-Za-z0-9_]{1,30})/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const handle = m[1].toLowerCase();
      const p = participants.find((pp) => (pp.username ?? "").toLowerCase() === handle);
      if (p) out.add(p.user_id);
    }
    return Array.from(out);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (open) return; // Let popover's Enter handle the pick.
    const body = draft.trim();
    if (!body) return;
    const ids = extractMentionIds(body);
    onSubmit(ids);
  }

  return (
    <form onSubmit={handleSubmit} className={cn("relative flex items-center gap-2", className)}>
      <MentionPopover
        open={open}
        query={query}
        sections={["user", "collab", "group", "event", "work", "post"]}
        extraUsers={extraUsers}
        onPick={insertSuggestion}
        onClose={() => setOpen(false)}
        tone={tone}
      />
      {leadingAction && <div className="shrink-0">{leadingAction}</div>}
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          syncToken(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        onSelect={(e) => {
          const el = e.currentTarget;
          syncToken(el.value, el.selectionStart ?? el.value.length);
        }}
        placeholder={placeholder}
        maxLength={1000}
        disabled={disabled}
        className={
          tone === "dark"
            ? "bg-background/10 border-background/10 text-background placeholder:text-background/40"
            : undefined
        }
      />
      <Button
        type="submit"
        size="icon"
        className="rounded-full shrink-0"
        disabled={!draft.trim() || sending || disabled}
        aria-label="Send message"
      >
        <Send className="h-4 w-4" />
      </Button>
    </form>
  );
}

/**
 * Render a chat / DM message body.
 *
 * Tokenizing is shared with the Today board (`@/lib/entities/parse`) and
 * reference chips come from `EntityReferenceChip`, so a Work referenced in a
 * DM behaves exactly as it does on a Today post. Participant-aware `@handle`
 * chips stay local to this surface.
 */
export function MessageBody({
  body,
  participants,
  meUsername,
  onMentionClick,
  renderMention,
  renderUnknownMention,
}: {
  body: string;
  participants: MentionCandidate[];
  meUsername?: string | null;
  onMentionClick?: (userId: string) => void;
  renderMention?: (args: {
    user: MentionCandidate;
    isMe: boolean;
    children: React.ReactNode;
  }) => React.ReactNode;
  renderUnknownMention?: (args: { handle: string; children: React.ReactNode }) => React.ReactNode;
}) {
  const parts = useMemo(() => parseEntityBody(body, { bareUrls: true }), [body]);

  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((p, i) => {
        if (p.type === "text") return <span key={i}>{p.value}</span>;
        if (p.type === "url") {
          return (
            <a
              key={i}
              href={p.href}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-primary break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {p.text}
            </a>
          );
        }
        if (p.type === "entity") {
          return (
            <EntityReferenceChip
              key={i}
              kind={p.kind}
              label={p.label}
              slug={p.slug}
              groupSlug={p.groupSlug}
            />
          );
        }
        const handle = p.username;
        const user = participants.find(
          (c) => (c.username ?? "").toLowerCase() === handle.toLowerCase(),
        );
        const isMe = !!meUsername && user?.username?.toLowerCase() === meUsername.toLowerCase();
        const chip = (
          <button
            type="button"
            onClick={() => user && onMentionClick?.(user.user_id)}
            className={cn(
              "rounded px-1 font-medium",
              isMe ? "bg-primary/20 text-primary" : "bg-foreground/10 hover:bg-foreground/20",
            )}
          >
            @{handle}
          </button>
        );
        if (user && renderMention) {
          return <span key={i}>{renderMention({ user, isMe, children: chip })}</span>;
        }
        if (!user && renderUnknownMention) {
          return <span key={i}>{renderUnknownMention({ handle, children: chip })}</span>;
        }
        return <span key={i}>{chip}</span>;
      })}
    </span>
  );
}
