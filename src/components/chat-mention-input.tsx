import { useMemo, useRef, useState } from "react";
import { Calendar, Megaphone, Send, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MentionPopover } from "@/components/mention-popover";
import { GroupPeek } from "@/components/group-peek";
import { EventPeek } from "@/components/event-peek";
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
        sections={["user", "collab", "group", "event", "work"]}
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
 * Render a chat message body with:
 *  - @handle chips (participant-aware, `meUsername` gets primary accent)
 *  - [Label](/collab|/g|/g/…/e/…) internal-link chips with peek popovers
 *  - Bare URL autolinks
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
  const parts = useMemo(() => {
    type Seg =
      | { type: "text"; text: string }
      | { type: "mention"; text: string; user?: MentionCandidate; handle: string }
      | { type: "link"; text: string; href: string }
      | { type: "collab"; label: string; slug: string }
      | { type: "group"; label: string; slug: string }
      | { type: "event"; label: string; groupSlug: string; eventSlug: string };

    type Hit = { start: number; end: number; seg: Seg };
    const hits: Hit[] = [];

    const eventRe =
      /\[([^\]\n]{1,120})\]\(\/g\/([a-zA-Z0-9_-]{1,80})\/e\/([a-zA-Z0-9_-]{1,80})\)/g;
    const groupRe = /\[([^\]\n]{1,120})\]\(\/g\/([a-zA-Z0-9_-]{1,80})\)/g;
    const collabRe = /\[([^\]\n]{1,120})\]\(\/collab\/([a-zA-Z0-9_-]{1,80})\)/g;
    const mentionRe = /(^|\s)@([A-Za-z0-9_]{1,30})/g;
    const urlRe = /\bhttps?:\/\/[^\s<]+/g;

    let m: RegExpExecArray | null;
    while ((m = eventRe.exec(body))) {
      hits.push({
        start: m.index,
        end: m.index + m[0].length,
        seg: { type: "event", label: m[1], groupSlug: m[2], eventSlug: m[3] },
      });
    }
    while ((m = groupRe.exec(body))) {
      if (hits.some((h) => m!.index >= h.start && m!.index < h.end)) continue;
      hits.push({
        start: m.index,
        end: m.index + m[0].length,
        seg: { type: "group", label: m[1], slug: m[2] },
      });
    }
    while ((m = collabRe.exec(body))) {
      if (hits.some((h) => m!.index >= h.start && m!.index < h.end)) continue;
      hits.push({
        start: m.index,
        end: m.index + m[0].length,
        seg: { type: "collab", label: m[1], slug: m[2] },
      });
    }
    while ((m = urlRe.exec(body))) {
      if (hits.some((h) => m!.index >= h.start && m!.index < h.end)) continue;
      hits.push({
        start: m.index,
        end: m.index + m[0].length,
        seg: { type: "link", text: m[0], href: m[0] },
      });
    }
    while ((m = mentionRe.exec(body))) {
      const at = m.index + (m[1]?.length ?? 0);
      const end = at + 1 + m[2].length;
      if (hits.some((h) => at >= h.start && at < h.end)) continue;
      const handle = m[2];
      const user = participants.find(
        (p) => (p.username ?? "").toLowerCase() === handle.toLowerCase(),
      );
      hits.push({
        start: at,
        end,
        seg: { type: "mention", text: `@${handle}`, user, handle },
      });
    }

    hits.sort((a, b) => a.start - b.start);

    const segments: Seg[] = [];
    let cursor = 0;
    for (const h of hits) {
      if (h.start > cursor) segments.push({ type: "text", text: body.slice(cursor, h.start) });
      segments.push(h.seg);
      cursor = h.end;
    }
    if (cursor < body.length) segments.push({ type: "text", text: body.slice(cursor) });
    return segments;
  }, [body, participants]);

  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((p, i) => {
        if (p.type === "text") return <span key={i}>{p.text}</span>;
        if (p.type === "link") {
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
        if (p.type === "collab") {
          return (
            <Link
              key={i}
              to="/collab/$slug"
              params={{ slug: p.slug }}
              className="mx-0.5 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/5 px-2 py-0.5 align-baseline text-[12px] font-medium text-primary hover:bg-primary/10"
            >
              <Megaphone className="h-3 w-3" />
              {p.label}
            </Link>
          );
        }
        if (p.type === "group") {
          return (
            <GroupPeek key={i} slug={p.slug}>
              <Link
                to="/g/$slug"
                params={{ slug: p.slug }}
                className="mx-0.5 inline-flex items-center gap-1 rounded-full border border-violet/30 bg-violet/5 px-2 py-0.5 align-baseline text-[12px] font-medium text-violet hover:bg-violet/10"
              >
                <Users className="h-3 w-3" />
                {p.label}
              </Link>
            </GroupPeek>
          );
        }
        if (p.type === "event") {
          return (
            <EventPeek key={i} groupSlug={p.groupSlug} eventSlug={p.eventSlug}>
              <Link
                to="/g/$slug/e/$eventSlug"
                params={{ slug: p.groupSlug, eventSlug: p.eventSlug }}
                className="mx-0.5 inline-flex items-center gap-1 rounded-full border border-coral/30 bg-coral/5 px-2 py-0.5 align-baseline text-[12px] font-medium text-coral hover:bg-coral/10"
              >
                <Calendar className="h-3 w-3" />
                {p.label}
              </Link>
            </EventPeek>
          );
        }
        // mention
        const isMe = !!meUsername && p.user?.username?.toLowerCase() === meUsername.toLowerCase();
        const chip = (
          <button
            type="button"
            onClick={() => p.user && onMentionClick?.(p.user.user_id)}
            className={cn(
              "rounded px-1 font-medium",
              isMe ? "bg-primary/20 text-primary" : "bg-foreground/10 hover:bg-foreground/20",
            )}
          >
            {p.text}
          </button>
        );
        if (p.user && renderMention) {
          return <span key={i}>{renderMention({ user: p.user, isMe, children: chip })}</span>;
        }
        if (!p.user && renderUnknownMention) {
          return <span key={i}>{renderUnknownMention({ handle: p.handle, children: chip })}</span>;
        }
        return <span key={i}>{chip}</span>;
      })}
    </span>
  );
}
