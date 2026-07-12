import { useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MentionCandidate = {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
};

/**
 * Chat composer with `@handle` typeahead over the current room participants.
 * Inserts `@username ` into the draft and tracks which user ids were tagged so
 * the parent can pass them through to the server fn.
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
  const [active, setActive] = useState<number>(0);
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
      setActive(0);
    } else {
      setTokenStart(null);
      setOpen(false);
    }
  }

  const matches = useMemo(() => {
    if (!open) return [];
    const q = query.trim().toLowerCase();
    return participants
      .filter((p) => {
        const u = (p.username ?? "").toLowerCase();
        const d = (p.display_name ?? "").toLowerCase();
        if (!u) return false;
        if (!q) return true;
        return u.startsWith(q) || u.includes(q) || d.includes(q);
      })
      .slice(0, 6);
  }, [open, query, participants]);

  function insertMention(c: MentionCandidate) {
    if (tokenStart === null || !c.username) return;
    const input = inputRef.current;
    const caret = input?.selectionStart ?? draft.length;
    const before = draft.slice(0, tokenStart);
    const after = draft.slice(caret);
    const insert = `@${c.username} `;
    const next = before + insert + after;
    setDraft(next);
    setOpen(false);
    setTokenStart(null);
    requestAnimationFrame(() => {
      const pos = (before + insert).length;
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

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (open && matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(matches[active]);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    const ids = extractMentionIds(body);
    onSubmit(ids);
  }

  return (
    <form onSubmit={handleSubmit} className={cn("relative flex items-center gap-2", className)}>
      {open && matches.length > 0 && (
        <div
          className={cn(
            "absolute bottom-full left-0 mb-2 w-72 max-w-[calc(100%-4rem)] overflow-hidden rounded-xl border shadow-lg z-30",
            tone === "dark"
              ? "border-background/15 bg-background/95 backdrop-blur text-ink"
              : "border-border bg-popover text-ink",
          )}
        >
          <ul className="max-h-60 overflow-y-auto py-1">
            {matches.map((c, i) => (
              <li key={c.user_id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(c);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm",
                    i === active ? "bg-muted" : "hover:bg-muted/60",
                  )}
                >
                  <div className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-muted text-[10px] flex items-center justify-center text-ink-muted">
                    {c.avatar_url ? (
                      <img src={c.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (c.display_name?.[0] ?? c.username?.[0] ?? "?").toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm">{c.display_name || c.username}</div>
                    {c.username && (
                      <div className="truncate text-[11px] text-ink-muted">@{c.username}</div>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {leadingAction && <div className="shrink-0">{leadingAction}</div>}
      <Input
        ref={inputRef}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          syncToken(e.target.value, e.target.selectionStart ?? e.target.value.length);
        }}
        onKeyDown={handleKey}
        onBlur={() => setTimeout(() => setOpen(false), 100)}
        onSelect={(e) => {
          const el = e.currentTarget;
          syncToken(el.value, el.selectionStart ?? el.value.length);
        }}
        placeholder={placeholder}
        maxLength={1000}
        disabled={disabled}
        className={tone === "dark" ? "bg-background/10 border-background/10 text-background placeholder:text-background/40" : undefined}
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
 * Render a chat message body with @handle chips. Mentions matching `meUsername`
 * get a primary accent.
 */
export function MessageBody({
  body,
  participants,
  meUsername,
  onMentionClick,
  renderMention,
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
}) {
  const parts = useMemo(() => {
    type Seg =
      | { type: "text"; text: string }
      | { type: "mention"; text: string; user?: MentionCandidate }
      | { type: "link"; text: string; href: string };
    const segments: Seg[] = [];
    const re = /(^|\s)@([A-Za-z0-9_]{1,30})|\bhttps?:\/\/[^\s<]+/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      const isMention = !!m[2];
      const matchStart = isMention ? m.index + (m[1]?.length ?? 0) : m.index;
      if (matchStart > last) segments.push({ type: "text", text: body.slice(last, matchStart) });
      if (isMention) {
        const handle = m[2].toLowerCase();
        const user = participants.find((p) => (p.username ?? "").toLowerCase() === handle);
        if (user) segments.push({ type: "mention", text: `@${user.username}`, user });
        else segments.push({ type: "text", text: `@${m[2]}` });
        last = matchStart + 1 + m[2].length;
      } else {
        const url = m[0];
        segments.push({ type: "link", text: url, href: url });
        last = matchStart + url.length;
      }
    }
    if (last < body.length) segments.push({ type: "text", text: body.slice(last) });
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
          return (
            <span key={i}>{renderMention({ user: p.user, isMe, children: chip })}</span>
          );
        }
        return <span key={i}>{chip}</span>;
      })}
    </span>
  );
}


