import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  Bold,
  Italic,
  Link as LinkIcon,
  Film,
  MoreHorizontal,
  Heading2,
  Heading3,
  Quote,
  List,
  ListOrdered,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type BlogBodyEditorProps = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  onDirty?: () => void;
};

function normalizeUrl(input: string): string | null {
  const t = (input || "").trim();
  if (!t) return null;
  const withProto = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`;
  try {
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function BlogBodyEditor({ value, onChange, readOnly, onDirty }: BlogBodyEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState("");
  const savedSelection = useRef<{ start: number; end: number } | null>(null);

  const wordCount = useMemo(() => value.trim().match(/\S+/g)?.length ?? 0, [value]);
  const readingMin = Math.max(1, Math.round(wordCount / 220));

  function commit(next: string) {
    onChange(next);
    onDirty?.();
  }

  function wrapSelection(before: string, after: string, placeholder: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const hasSel = end > start;
    const sel = hasSel ? value.slice(start, end) : placeholder;
    const next = value.slice(0, start) + before + sel + after + value.slice(end);
    commit(next);
    requestAnimationFrame(() => {
      el.focus();
      if (hasSel) {
        const pos = start + before.length + sel.length + after.length;
        el.setSelectionRange(pos, pos);
      } else {
        const from = start + before.length;
        el.setSelectionRange(from, from + sel.length);
      }
    });
  }

  function insertLinePrefix(prefix: string, placeholder: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const hasSel = end > start;
    const insertion = hasSel ? value.slice(start, end) : placeholder;
    const needsNl = start > 0 && value[start - 1] !== "\n";
    const pre = needsNl ? "\n" : "";
    const next = value.slice(0, start) + pre + prefix + insertion + value.slice(end);
    commit(next);
    requestAnimationFrame(() => {
      el.focus();
      const from = start + pre.length + prefix.length;
      el.setSelectionRange(from, from + insertion.length);
    });
  }

  function openLink() {
    const el = ref.current;
    if (!el) {
      setLinkOpen(true);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    savedSelection.current = { start, end };
    setLinkText(end > start ? value.slice(start, end) : "");
    setLinkUrl("");
    setLinkOpen(true);
  }

  function insertLink() {
    const url = normalizeUrl(linkUrl);
    if (!url) {
      toast.error("Enter a valid URL (must start with https:// or http://).");
      return;
    }
    const text = linkText.trim() || url;
    const md = `[${text}](${url})`;
    const el = ref.current;
    const sel = savedSelection.current;
    const start = sel?.start ?? el?.selectionStart ?? value.length;
    const end = sel?.end ?? el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + md + value.slice(end);
    commit(next);
    setLinkOpen(false);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + md.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function openEmbed() {
    const el = ref.current;
    if (el) savedSelection.current = { start: el.selectionStart, end: el.selectionEnd };
    setEmbedUrl("");
    setEmbedOpen(true);
  }

  function insertEmbed() {
    const url = normalizeUrl(embedUrl);
    if (!url) {
      toast.error("Enter a valid URL (must start with https:// or http://).");
      return;
    }
    const marker = `[[embed:${url}]]`;
    const el = ref.current;
    const sel = savedSelection.current;
    const start = sel?.start ?? el?.selectionStart ?? value.length;
    const end = sel?.end ?? el?.selectionEnd ?? value.length;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const leadNl = before.length === 0 || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
    const trailNl = after.length === 0 || after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
    const block = `${leadNl}${marker}${trailNl}`;
    const next = before + block + after;
    commit(next);
    setEmbedOpen(false);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + block.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (readOnly) return;
    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;
    const k = e.key.toLowerCase();
    if (k === "b") {
      e.preventDefault();
      wrapSelection("**", "**", "bold text");
    } else if (k === "i") {
      e.preventDefault();
      wrapSelection("_", "_", "italic text");
    } else if (k === "k") {
      e.preventDefault();
      openLink();
    }
  }

  useEffect(() => {
    if (!linkOpen && !embedOpen) savedSelection.current = null;
  }, [linkOpen, embedOpen]);

  return (
    <div className="rounded-2xl border border-border bg-surface p-3 md:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">Body</span>
          <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-wider text-ink-muted">
            Markdown-light
          </span>
        </div>
        <div className="ml-auto -mx-1 flex items-center gap-1 overflow-x-auto px-1">
          <ToolBtn onClick={() => wrapSelection("**", "**", "bold text")} title="Bold (⌘B)" disabled={readOnly}>
            <Bold className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn onClick={() => wrapSelection("_", "_", "italic text")} title="Italic (⌘I)" disabled={readOnly}>
            <Italic className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn onClick={openLink} title="Link (⌘K)" disabled={readOnly}>
            <LinkIcon className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn onClick={openEmbed} title="Embed video or link card" disabled={readOnly}>
            <Film className="h-4 w-4" />
          </ToolBtn>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                disabled={readOnly}
                title="More formatting"
                aria-label="More formatting"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-muted disabled:opacity-40"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => insertLinePrefix("## ", "Heading")}>
                <Heading2 className="mr-2 h-4 w-4" /> Heading 2
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => insertLinePrefix("### ", "Heading")}>
                <Heading3 className="mr-2 h-4 w-4" /> Heading 3
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => insertLinePrefix("> ", "Quote")}>
                <Quote className="mr-2 h-4 w-4" /> Quote
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => insertLinePrefix("- ", "List item")}>
                <List className="mr-2 h-4 w-4" /> Bulleted list
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => insertLinePrefix("1. ", "List item")}>
                <ListOrdered className="mr-2 h-4 w-4" /> Numbered list
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <textarea
        ref={ref}
        value={value}
        readOnly={readOnly}
        onChange={(e) => commit(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Write your post…"
        className={cn(
          "mt-3 block w-full resize-y rounded-xl border border-border bg-background px-4 py-4 text-[16px] leading-[1.7] text-ink",
          "focus:border-primary focus:outline-none",
          "min-h-[360px] md:min-h-[560px]",
        )}
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-muted">
        <span>Use the toolbar to format text or add a link. Markdown is supported.</span>
        <span>
          {wordCount} words · ~{readingMin} min read
        </span>
      </div>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert link</DialogTitle>
            <DialogDescription>Add a hyperlink to your post.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="blog-link-text">Text</Label>
              <Input
                id="blog-link-text"
                value={linkText}
                onChange={(e) => setLinkText(e.target.value)}
                placeholder="Link text"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="blog-link-url">URL</Label>
              <Input
                id="blog-link-url"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://example.com"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    insertLink();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={insertLink}>
              Add link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={embedOpen} onOpenChange={setEmbedOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add embed</DialogTitle>
            <DialogDescription>
              Paste a YouTube or Vimeo video, or add another URL as a link card.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="blog-embed-url">URL</Label>
            <Input
              id="blog-embed-url"
              value={embedUrl}
              onChange={(e) => setEmbedUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=…"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  insertEmbed();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEmbedOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={insertEmbed}>
              Add embed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToolBtn({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-soft hover:bg-muted disabled:opacity-40"
    >
      {children}
    </button>
  );
}
