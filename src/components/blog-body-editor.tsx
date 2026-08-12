import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
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
  AtSign,
  Pencil,
  Trash2,
  ImagePlus,
  Images,
  Upload,
  Loader2,
  X,
  ArrowLeft,
  ArrowRight,
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
import { BlogEmbed } from "@/components/blog-embed";
import { BlogFigure } from "@/components/blog-figure";
import { BlogGallery } from "@/components/blog-gallery";
import { uploadToBucket } from "@/lib/storage";
import { resizeImageToJpeg } from "@/lib/image-resize";
import { useAuth } from "@/hooks/use-auth";
import {
  parseSegments,
  serializeSegments,
  trimBlankLines,
  MAX_GALLERY_ITEMS,
  type BlogGallery as BlogGalleryData,
  type BlogGalleryItem,
  type BlogImageMeta,
  type BodySegment,
} from "@/lib/blog-body-segments";


export type BlogBodyEditorProps = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  onDirty?: () => void;
  /**
   * Optional hook: when the user clicks the "@" tag button, the editor invokes
   * this callback with an `insertMarkdown` function pinned to the current
   * cursor position. The consumer opens its own entity picker and, once the
   * user selects an entity, calls `insertMarkdown("[label](/url)")` to place
   * the link in the body at the original cursor.
   */
  onRequestEntityInsert?: (insertMarkdown: (md: string) => void) => void;
  /**
   * Fires whenever a composer dialog is open or an upload is in flight, so a
   * consumer's autosave can hold off on persisting a half-built block.
   */
  onBusyChange?: (busy: boolean) => void;
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

/**
 * Markdown-light composer that renders `[[embed:URL]]` markers as the real
 * Workshop embed card while keeping one canonical Markdown string as the
 * source of truth. The writing surface is a stack of auto-growing textareas
 * (one per text segment) separated by embed cards; every toolbar action
 * targets the segment that currently holds the caret.
 */
export function BlogBodyEditor({ value, onChange, readOnly, onDirty, onRequestEntityInsert }: BlogBodyEditorProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [embedOpen, setEmbedOpen] = useState(false);
  const [embedUrl, setEmbedUrl] = useState("");
  /** Index of the embed segment being edited, or null when inserting a new one. */
  const [embedEditIndex, setEmbedEditIndex] = useState<number | null>(null);
  const [imageOpen, setImageOpen] = useState(false);
  const [imageEditIndex, setImageEditIndex] = useState<number | null>(null);
  const [imageDraft, setImageDraft] = useState<BlogImageMeta>({ url: "" });
  const [uploading, setUploading] = useState(false);
  const [imagePreviewBroken, setImagePreviewBroken] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryEditIndex, setGalleryEditIndex] = useState<number | null>(null);
  const [galleryDraft, setGalleryDraft] = useState<BlogGalleryData>({ items: [], layout: "wall" });
  const [galleryUploading, setGalleryUploading] = useState(false);
  const [galleryUrlInput, setGalleryUrlInput] = useState("");
  const galleryFileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();


  const segments = useMemo(() => parseSegments(value), [value]);

  /** Raw text of the focused segment, so trailing newlines survive typing. */
  const [local, setLocal] = useState<{ idx: number; text: string } | null>(null);
  const refs = useRef(new Map<number, HTMLTextAreaElement>());
  const activeIdx = useRef(0);
  const savedSelection = useRef<{ idx: number; start: number; end: number } | null>(null);
  const pendingFocus = useRef<{ idx: number; start: number; end: number } | null>(null);

  const displayText = useCallback(
    (idx: number, seg: BodySegment) => {
      if (seg.type !== "text") return "";
      if (local && local.idx === idx) return local.text;
      return trimBlankLines(seg.text);
    },
    [local],
  );

  useLayoutEffect(() => {
    const p = pendingFocus.current;
    if (!p) return;
    pendingFocus.current = null;
    const el = refs.current.get(p.idx);
    if (!el) return;
    el.focus();
    el.setSelectionRange(p.start, p.end);
  });

  const wordCount = useMemo(() => value.trim().match(/\S+/g)?.length ?? 0, [value]);
  const readingMin = Math.max(1, Math.round(wordCount / 220));

  function commitSegments(next: BodySegment[]) {
    onChange(serializeSegments(next));
    onDirty?.();
  }

  /** Returns the active text segment index, falling back to the last one. */
  function activeTextIndex(): number {
    const i = activeIdx.current;
    if (segments[i]?.type === "text") return i;
    for (let j = segments.length - 1; j >= 0; j--) if (segments[j].type === "text") return j;
    return 0;
  }

  function setSegmentText(idx: number, text: string, caret?: { start: number; end: number }) {
    setLocal({ idx, text });
    const next = segments.map((s, i) => (i === idx && s.type === "text" ? { ...s, text } : s));
    commitSegments(next);
    if (caret) pendingFocus.current = { idx, ...caret };
  }

  function currentTarget() {
    const idx = activeTextIndex();
    const el = refs.current.get(idx);
    const seg = segments[idx];
    const text = el?.value ?? (seg && seg.type === "text" ? trimBlankLines(seg.text) : "");
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    return { idx, text, start, end };
  }

  function wrapSelection(before: string, after: string, placeholder: string) {
    if (readOnly) return;
    const { idx, text, start, end } = currentTarget();
    const hasSel = end > start;
    const sel = hasSel ? text.slice(start, end) : placeholder;
    const next = text.slice(0, start) + before + sel + after + text.slice(end);
    const caret = hasSel
      ? { start: start + before.length + sel.length + after.length, end: start + before.length + sel.length + after.length }
      : { start: start + before.length, end: start + before.length + sel.length };
    setSegmentText(idx, next, caret);
  }

  function insertLinePrefix(prefix: string, placeholder: string) {
    if (readOnly) return;
    const { idx, text, start, end } = currentTarget();
    const hasSel = end > start;
    const insertion = hasSel ? text.slice(start, end) : placeholder;
    const needsNl = start > 0 && text[start - 1] !== "\n";
    const pre = needsNl ? "\n" : "";
    const next = text.slice(0, start) + pre + prefix + insertion + text.slice(end);
    const from = start + pre.length + prefix.length;
    setSegmentText(idx, next, { start: from, end: from + insertion.length });
  }

  function openLink() {
    const { idx, text, start, end } = currentTarget();
    savedSelection.current = { idx, start, end };
    setLinkText(end > start ? text.slice(start, end) : "");
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
    const sel = savedSelection.current ?? { idx: activeTextIndex(), start: 0, end: 0 };
    const seg = segments[sel.idx];
    const source = refs.current.get(sel.idx)?.value ?? (seg && seg.type === "text" ? trimBlankLines(seg.text) : "");
    const next = source.slice(0, sel.start) + md + source.slice(sel.end);
    const pos = sel.start + md.length;
    setLinkOpen(false);
    setSegmentText(sel.idx, next, { start: pos, end: pos });
  }

  function openEmbed() {
    const { idx, start, end } = currentTarget();
    savedSelection.current = { idx, start, end };
    setEmbedEditIndex(null);
    setEmbedUrl("");
    setEmbedOpen(true);
  }

  function openEmbedEdit(idx: number) {
    const seg = segments[idx];
    if (!seg || seg.type !== "embed") return;
    savedSelection.current = null;
    setEmbedEditIndex(idx);
    setEmbedUrl(seg.url);
    setEmbedOpen(true);
  }

  function submitEmbed() {
    const url = normalizeUrl(embedUrl);
    if (!url) {
      toast.error("Enter a valid URL (must start with https:// or http://).");
      return;
    }

    if (embedEditIndex != null) {
      const next = segments.map((s, i) => (i === embedEditIndex && s.type === "embed" ? { ...s, url } : s));
      setEmbedOpen(false);
      setEmbedEditIndex(null);
      setLocal(null);
      commitSegments(next);
      return;
    }

    // Split the active text segment at the caret and drop the embed between.
    const sel = savedSelection.current ?? { idx: activeTextIndex(), start: 0, end: 0 };
    const seg = segments[sel.idx];
    const source = refs.current.get(sel.idx)?.value ?? (seg && seg.type === "text" ? trimBlankLines(seg.text) : "");
    const before = source.slice(0, sel.start);
    const after = source.slice(Math.max(sel.end, sel.start));
    const next: BodySegment[] = [
      ...segments.slice(0, sel.idx),
      { type: "text", text: before },
      { type: "embed", url },
      { type: "text", text: after },
      ...segments.slice(sel.idx + 1),
    ];
    setEmbedOpen(false);
    setLocal(null);
    commitSegments(next);
    pendingFocus.current = { idx: sel.idx + 2, start: 0, end: 0 };
  }

  /** Removes a block (embed or image) and merges the text segments around it. */
  function removeEmbed(idx: number) {
    const prev = segments[idx - 1];
    const nextSeg = segments[idx + 1];
    const merged = trimBlankLines(
      [
        prev && prev.type === "text" ? trimBlankLines(prev.text) : "",
        nextSeg && nextSeg.type === "text" ? trimBlankLines(nextSeg.text) : "",
      ]
        .filter(Boolean)
        .join("\n\n"),
    );
    const out: BodySegment[] = [
      ...segments.slice(0, Math.max(0, idx - 1)),
      { type: "text", text: merged },
      ...segments.slice(idx + 2),
    ];
    setLocal(null);
    commitSegments(out);
    const caret = prev && prev.type === "text" ? trimBlankLines(prev.text).length : 0;
    pendingFocus.current = { idx: Math.max(0, idx - 1), start: caret, end: caret };
  }

  function openImage() {
    const { idx, start, end } = currentTarget();
    savedSelection.current = { idx, start, end };
    setImageEditIndex(null);
    setImageDraft({ url: "" });
    setImageOpen(true);
  }

  function openImageEdit(idx: number) {
    const seg = segments[idx];
    if (!seg || seg.type !== "image") return;
    savedSelection.current = null;
    setImageEditIndex(idx);
    setImageDraft({ ...seg.image });
    setImageOpen(true);
  }

  async function handleImageFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImageFile(file);
      if (url) {
        setImagePreviewBroken(false);
        setImageDraft((d) => ({ ...d, url }));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }


  function submitImage() {
    const url = normalizeUrl(imageDraft.url);
    if (!url) {
      toast.error("Upload a photo or paste an image URL first.");
      return;
    }
    const link = imageDraft.link?.trim()
      ? imageDraft.link.trim().startsWith("/")
        ? imageDraft.link.trim()
        : normalizeUrl(imageDraft.link)
      : undefined;
    if (imageDraft.link?.trim() && !link) {
      toast.error("Enter a valid link URL (or leave it blank).");
      return;
    }
    const image: BlogImageMeta = {
      url,
      alt: imageDraft.alt?.trim() || undefined,
      caption: imageDraft.caption?.trim() || undefined,
      credit: imageDraft.credit?.trim() || undefined,
      link: link || undefined,
    };

    if (imageEditIndex != null) {
      const next = segments.map((s, i) => (i === imageEditIndex && s.type === "image" ? { type: "image" as const, image } : s));
      setImageOpen(false);
      setImageEditIndex(null);
      setLocal(null);
      commitSegments(next);
      return;
    }

    const sel = savedSelection.current ?? { idx: activeTextIndex(), start: 0, end: 0 };
    const seg = segments[sel.idx];
    const source = refs.current.get(sel.idx)?.value ?? (seg && seg.type === "text" ? trimBlankLines(seg.text) : "");
    const before = source.slice(0, sel.start);
    const after = source.slice(Math.max(sel.end, sel.start));
    const next: BodySegment[] = [
      ...segments.slice(0, sel.idx),
      { type: "text", text: before },
      { type: "image", image },
      { type: "text", text: after },
      ...segments.slice(sel.idx + 1),
    ];
    setImageOpen(false);
    setLocal(null);
    commitSegments(next);
    pendingFocus.current = { idx: sel.idx + 2, start: 0, end: 0 };
  }

  /** Shared upload pipeline: validate, downscale (except GIFs), store. */
  async function uploadImageFile(file: File): Promise<string | null> {
    if (!user) {
      toast.error("Sign in again to upload images.");
      return null;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file (JPG, PNG, WebP, or GIF).");
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(`"${file.name}" is too large. Max 10MB.`);
      return null;
    }
    let upload: File = file;
    if (file.type !== "image/gif") {
      const { blob } = await resizeImageToJpeg(file, 2048, 0.85);
      upload = new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.jpg`, { type: "image/jpeg" });
    }
    return uploadToBucket("covers", user.id, upload);
  }

  function openGallery() {
    const { idx, start, end } = currentTarget();
    savedSelection.current = { idx, start, end };
    setGalleryEditIndex(null);
    setGalleryDraft({ items: [], layout: "wall" });
    setGalleryUrlInput("");
    setGalleryOpen(true);
  }

  function openGalleryEdit(idx: number) {
    const seg = segments[idx];
    if (!seg || seg.type !== "gallery") return;
    savedSelection.current = null;
    setGalleryEditIndex(idx);
    setGalleryDraft({ ...seg.gallery, items: seg.gallery.items.map((i) => ({ ...i })) });
    setGalleryUrlInput("");
    setGalleryOpen(true);
  }

  async function handleGalleryFiles(files: FileList | File[] | null | undefined) {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    const room = MAX_GALLERY_ITEMS - galleryDraft.items.length;
    if (room <= 0) {
      toast.error(`A gallery holds up to ${MAX_GALLERY_ITEMS} photos.`);
      return;
    }
    if (list.length > room) toast.message(`Only the first ${room} photos were added.`);
    setGalleryUploading(true);
    try {
      const added: BlogGalleryItem[] = [];
      for (const file of list.slice(0, room)) {
        try {
          const url = await uploadImageFile(file);
          if (url) added.push({ url });
        } catch (e) {
          toast.error(e instanceof Error ? e.message : `Couldn't upload "${file.name}".`);
        }
      }
      if (added.length) setGalleryDraft((g) => ({ ...g, items: [...g.items, ...added] }));
    } finally {
      setGalleryUploading(false);
      if (galleryFileRef.current) galleryFileRef.current.value = "";
    }
  }

  function addGalleryUrl() {
    const url = normalizeUrl(galleryUrlInput);
    if (!url) {
      toast.error("Enter a valid image URL (must start with https://).");
      return;
    }
    if (galleryDraft.items.length >= MAX_GALLERY_ITEMS) {
      toast.error(`A gallery holds up to ${MAX_GALLERY_ITEMS} photos.`);
      return;
    }
    setGalleryDraft((g) => ({ ...g, items: [...g.items, { url }] }));
    setGalleryUrlInput("");
  }

  function moveGalleryItem(i: number, dir: -1 | 1) {
    setGalleryDraft((g) => {
      const items = [...g.items];
      const j = i + dir;
      if (j < 0 || j >= items.length) return g;
      [items[i], items[j]] = [items[j], items[i]];
      return { ...g, items };
    });
  }

  function submitGallery() {
    const items = galleryDraft.items.filter((i) => i.url.trim().length > 0);
    if (items.length < 2) {
      toast.error("Add at least two photos to a gallery.");
      return;
    }
    const caption = (galleryDraft.caption ?? "").trim();
    const gallery: BlogGalleryData = {
      items: items.slice(0, MAX_GALLERY_ITEMS),
      layout: galleryDraft.layout,
      ...(caption ? { caption } : {}),
    };

    if (galleryEditIndex != null) {
      const next = segments.map((s, i) =>
        i === galleryEditIndex && s.type === "gallery" ? { type: "gallery" as const, gallery } : s,
      );
      setGalleryOpen(false);
      setGalleryEditIndex(null);
      setLocal(null);
      commitSegments(next);
      return;
    }

    const sel = savedSelection.current ?? { idx: activeTextIndex(), start: 0, end: 0 };
    const seg = segments[sel.idx];
    const source = refs.current.get(sel.idx)?.value ?? (seg && seg.type === "text" ? trimBlankLines(seg.text) : "");
    const before = source.slice(0, sel.start);
    const after = source.slice(Math.max(sel.end, sel.start));
    const next: BodySegment[] = [
      ...segments.slice(0, sel.idx),
      { type: "text", text: before },
      { type: "gallery", gallery },
      { type: "text", text: after },
      ...segments.slice(sel.idx + 1),
    ];
    setGalleryOpen(false);
    setLocal(null);
    commitSegments(next);
    pendingFocus.current = { idx: sel.idx + 2, start: 0, end: 0 };
  }



  /**
   * Opens the consumer's entity picker with an insert callback pinned to the
   * caret in the active text segment.
   */
  function requestEntityInsert(range?: { idx: number; start: number; end: number; source: string }) {
    if (!onRequestEntityInsert) return;
    const t = currentTarget();
    const idx = range?.idx ?? t.idx;
    const source = range?.source ?? t.text;
    const start = range?.start ?? t.start;
    const end = range?.end ?? t.end;
    const insert = (md: string) => {
      const next = source.slice(0, start) + md + source.slice(Math.max(end, start));
      const pos = start + md.length;
      setSegmentText(idx, next, { start: pos, end: pos });
    };
    onRequestEntityInsert(insert);
  }

  /**
   * Typing "@" at the start of a line or after whitespace opens the picker.
   * Inside a word (e.g. an email address) it stays a plain character.
   */
  function handleSegmentChange(idx: number, nextText: string, prevText: string) {
    setSegmentText(idx, nextText);
    if (readOnly || !onRequestEntityInsert) return;
    const el = refs.current.get(idx);
    const caret = el?.selectionStart ?? nextText.length;
    if (nextText.length !== prevText.length + 1) return;
    if (nextText[caret - 1] !== "@") return;
    const prev = caret >= 2 ? nextText[caret - 2] : "";
    if (prev && !/\s/.test(prev)) return;
    requestAnimationFrame(() =>
      requestEntityInsert({ idx, start: caret - 1, end: caret, source: nextText }),
    );
  }

  function onSegmentKeyDown(e: KeyboardEvent<HTMLTextAreaElement>, idx: number) {
    if (readOnly) return;
    const el = e.currentTarget;
    // Backspace at the very start of the text directly below an embed removes it.
    if (
      e.key === "Backspace" &&
      el.selectionStart === 0 &&
      el.selectionEnd === 0 &&
      (segments[idx - 1]?.type === "embed" || segments[idx - 1]?.type === "image")
    ) {
      e.preventDefault();
      removeEmbed(idx - 1);
      return;
    }
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
    if (!linkOpen && !embedOpen && !imageOpen && !galleryOpen) savedSelection.current = null;
  }, [linkOpen, embedOpen, imageOpen, galleryOpen]);


  const onlyText = segments.length === 1;

  return (
    <div className="rounded-2xl border border-border bg-surface p-3 md:p-4">
      <div className="sticky top-11 z-10 -mx-3 -mt-3 mb-2 flex flex-wrap items-center gap-2 border-b border-border bg-surface px-3 pb-2 pt-3 md:top-14 md:-mx-4 md:-mt-4 md:px-4 md:pb-2 md:pt-4">
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
          <ToolBtn onClick={openImage} title="Insert image" disabled={readOnly}>
            <ImagePlus className="h-4 w-4" />
          </ToolBtn>
          <ToolBtn onClick={openGallery} title="Insert gallery" disabled={readOnly}>
            <Images className="h-4 w-4" />
          </ToolBtn>

          {onRequestEntityInsert && (
            <button
              type="button"
              onClick={() => requestEntityInsert()}
              disabled={readOnly}
              title="Tag a person, Work, Collab, Group, or Event"
              aria-label="Tag a person, Work, Collab, Group, or Event"
              className="inline-flex h-11 shrink-0 items-center gap-1 rounded-full px-3 text-sm text-ink-soft hover:bg-muted disabled:opacity-40"
            >
              <AtSign className="h-4 w-4" /> Tag
            </button>
          )}
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

      <div
        className={cn(
          "mt-3 w-full overflow-hidden rounded-xl border border-border bg-background px-4 py-3",
          onlyText ? "min-h-[360px] md:min-h-[560px]" : "min-h-[360px]",
        )}
      >
        {segments.map((seg, i) =>
          seg.type === "embed" ? (
            <ComposerEmbedBlock
              key={`e-${i}`}
              url={seg.url}
              readOnly={readOnly}
              onEdit={() => openEmbedEdit(i)}
              onRemove={() => removeEmbed(i)}
            />
          ) : seg.type === "image" ? (
            <ComposerBlock
              key={`i-${i}`}
              readOnly={readOnly}
              onEdit={() => openImageEdit(i)}
              onRemove={() => removeEmbed(i)}
            >
              <BlogFigure image={seg.image} inert className="my-0" />
            </ComposerBlock>
          ) : seg.type === "gallery" ? (
            <ComposerBlock
              key={`g-${i}`}
              readOnly={readOnly}
              onEdit={() => openGalleryEdit(i)}
              onRemove={() => removeEmbed(i)}
            >
              <BlogGallery gallery={seg.gallery} inert className="my-0" />
            </ComposerBlock>
          ) : (

            <AutoTextarea
              key={`t-${i}`}
              registerRef={(el) => {
                if (el) refs.current.set(i, el);
                else refs.current.delete(i);
              }}
              value={displayText(i, seg)}
              readOnly={readOnly}
              placeholder={i === 0 ? "Write your post…" : undefined}
              minHeight={onlyText ? 320 : 48}
              onFocus={() => {
                activeIdx.current = i;
              }}
              onBlur={() => setLocal((l) => (l && l.idx === i ? null : l))}
              onChange={(next) => handleSegmentChange(i, next, displayText(i, seg))}
              onKeyDown={(e) => onSegmentKeyDown(e, i)}
            />
          ),
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-muted">
        <span>
          {onRequestEntityInsert
            ? "Use @ to tag a person, Work, Collab, Group, or Event. Markdown is supported."
            : "Use the toolbar to format text or add a link. Markdown is supported."}
        </span>
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

      <Dialog
        open={embedOpen}
        onOpenChange={(o) => {
          setEmbedOpen(o);
          if (!o) setEmbedEditIndex(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{embedEditIndex != null ? "Edit embed" : "Add embed"}</DialogTitle>
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
                  submitEmbed();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setEmbedOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitEmbed}>
              {embedEditIndex != null ? "Save embed" : "Add embed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={imageOpen}
        onOpenChange={(o) => {
          setImageOpen(o);
          if (!o) setImageEditIndex(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{imageEditIndex != null ? "Edit image" : "Insert image"}</DialogTitle>
            <DialogDescription>
              Upload a photo or paste an image URL. It renders centered in the post.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {imageDraft.url ? (
              imagePreviewBroken ? (
                <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
                  That image URL didn't load. Check the address, or upload the photo instead.
                </p>
              ) : (
                <div className="overflow-hidden rounded-xl border border-border bg-muted/30">
                  <img
                    src={imageDraft.url}
                    alt=""
                    className="mx-auto block max-h-56 w-full object-contain"
                    onError={() => setImagePreviewBroken(true)}
                    onLoad={() => setImagePreviewBroken(false)}
                  />
                </div>
              )
            ) : null}


            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {uploading ? "Uploading…" : imageDraft.url ? "Replace photo" : "Upload photo"}
              </Button>
              <span className="text-[11px] text-ink-muted">JPG, PNG, WebP or GIF · up to 10MB</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void handleImageFile(e.target.files?.[0])}
              />
            </div>

            <div>
              <Label htmlFor="blog-image-url">Image URL</Label>
              <Input
                id="blog-image-url"
                value={imageDraft.url}
                onChange={(e) => {
                  setImagePreviewBroken(false);
                  setImageDraft((d) => ({ ...d, url: e.target.value }));
                }}
                placeholder="https://example.com/photo.jpg"
              />

            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="blog-image-alt">Alt text</Label>
                <Input
                  id="blog-image-alt"
                  value={imageDraft.alt ?? ""}
                  onChange={(e) => setImageDraft((d) => ({ ...d, alt: e.target.value }))}
                  placeholder="Describe the photo"
                />
              </div>
              <div>
                <Label htmlFor="blog-image-credit">Credit</Label>
                <Input
                  id="blog-image-credit"
                  value={imageDraft.credit ?? ""}
                  onChange={(e) => setImageDraft((d) => ({ ...d, credit: e.target.value }))}
                  placeholder="Photo by…"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="blog-image-caption">Caption</Label>
              <Input
                id="blog-image-caption"
                value={imageDraft.caption ?? ""}
                onChange={(e) => setImageDraft((d) => ({ ...d, caption: e.target.value }))}
                placeholder="Shown under the image"
              />
            </div>
            <div>
              <Label htmlFor="blog-image-link">Click-through link (optional)</Label>
              <Input
                id="blog-image-link"
                value={imageDraft.link ?? ""}
                onChange={(e) => setImageDraft((d) => ({ ...d, link: e.target.value }))}
                placeholder="https://example.com or /u/username"
              />
              <p className="mt-1 text-[11px] text-ink-muted">
                With a link, clicking the image opens it. Without one, it opens in the lightbox.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setImageOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitImage} disabled={uploading}>
              {imageEditIndex != null ? "Save image" : "Insert image"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={galleryOpen}
        onOpenChange={(o) => {
          setGalleryOpen(o);
          if (!o) setGalleryEditIndex(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{galleryEditIndex != null ? "Edit gallery" : "Insert gallery"}</DialogTitle>
            <DialogDescription>
              Two to {MAX_GALLERY_ITEMS} photos, shown as a photo wall or a swipeable slideshow.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => galleryFileRef.current?.click()}
                disabled={galleryUploading || galleryDraft.items.length >= MAX_GALLERY_ITEMS}
              >
                {galleryUploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                {galleryUploading ? "Uploading…" : "Upload photos"}
              </Button>
              <span className="text-[11px] text-ink-muted">
                {galleryDraft.items.length}/{MAX_GALLERY_ITEMS} · JPG, PNG, WebP or GIF · up to 10MB each
              </span>
              <input
                ref={galleryFileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => void handleGalleryFiles(e.target.files)}
              />
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Label htmlFor="blog-gallery-url">Or add an image URL</Label>
                <Input
                  id="blog-gallery-url"
                  value={galleryUrlInput}
                  onChange={(e) => setGalleryUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addGalleryUrl();
                    }
                  }}
                  placeholder="https://example.com/photo.jpg"
                />
              </div>
              <Button type="button" variant="outline" onClick={addGalleryUrl}>
                Add
              </Button>
            </div>

            {galleryDraft.items.length > 0 && (
              <div className="space-y-2">
                {galleryDraft.items.map((item, i) => (
                  <div key={`${item.url}-${i}`} className="flex items-center gap-2 rounded-xl border border-border p-2">
                    <img
                      src={item.url}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg border border-border object-cover"
                    />
                    <Input
                      value={item.alt ?? ""}
                      onChange={(e) =>
                        setGalleryDraft((g) => ({
                          ...g,
                          items: g.items.map((it, j) => (j === i ? { ...it, alt: e.target.value } : it)),
                        }))
                      }
                      placeholder="Alt text (optional)"
                      className="h-9"
                    />
                    <div className="flex shrink-0 items-center gap-1">
                      <ToolBtn onClick={() => moveGalleryItem(i, -1)} title="Move earlier" disabled={i === 0}>
                        <ArrowLeft className="h-4 w-4" />
                      </ToolBtn>
                      <ToolBtn
                        onClick={() => moveGalleryItem(i, 1)}
                        title="Move later"
                        disabled={i === galleryDraft.items.length - 1}
                      >
                        <ArrowRight className="h-4 w-4" />
                      </ToolBtn>
                      <ToolBtn
                        onClick={() =>
                          setGalleryDraft((g) => ({ ...g, items: g.items.filter((_, j) => j !== i) }))
                        }
                        title="Remove photo"
                      >
                        <X className="h-4 w-4" />
                      </ToolBtn>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-wider text-ink-muted">Layout</span>
              {(["wall", "slideshow"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setGalleryDraft((g) => ({ ...g, layout: l }))}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs capitalize transition",
                    galleryDraft.layout === l
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-ink-soft hover:bg-muted",
                  )}
                >
                  {l === "wall" ? "Photo wall" : "Slideshow"}
                </button>
              ))}
            </div>

            <div>
              <Label htmlFor="blog-gallery-caption">Caption</Label>
              <Input
                id="blog-gallery-caption"
                value={galleryDraft.caption ?? ""}
                onChange={(e) => setGalleryDraft((g) => ({ ...g, caption: e.target.value }))}
                placeholder="Shown under the gallery"
              />
            </div>

            {galleryDraft.items.length >= 2 && (
              <div className="rounded-xl border border-border bg-background p-2">
                <BlogGallery gallery={galleryDraft} inert className="my-0" />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setGalleryOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={submitGallery} disabled={galleryUploading}>
              {galleryEditIndex != null ? "Save gallery" : "Insert gallery"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

/** Shared shell for non-text blocks in the composer: preview + author controls. */
function ComposerBlock({
  children,
  readOnly,
  onEdit,
  onRemove,
}: {
  children: React.ReactNode;
  readOnly?: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="my-2 rounded-2xl border border-dashed border-border/70 p-2">
      <div className="pointer-events-none select-none [&_.my-6]:my-0">{children}</div>
      {!readOnly && (
        <div className="mt-2 flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-ink-soft hover:bg-muted"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-ink-soft hover:bg-muted"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        </div>
      )}
    </div>
  );
}

/** The published embed card, shown inert inside the composer with author controls. */
function ComposerEmbedBlock({
  url,
  readOnly,
  onEdit,
  onRemove,
}: {
  url: string;
  readOnly?: boolean;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="my-2 rounded-2xl border border-dashed border-border/70 p-2">
      <div className="pointer-events-none select-none [&_.my-6]:my-0">
        <BlogEmbed url={url} />
      </div>
      {!readOnly && (
        <div className="mt-2 flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-ink-soft hover:bg-muted"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-ink-soft hover:bg-muted"
          >
            <Trash2 className="h-3.5 w-3.5" /> Remove
          </button>
        </div>
      )}
    </div>
  );
}

function AutoTextarea({
  value,
  onChange,
  onKeyDown,
  onFocus,
  onBlur,
  placeholder,
  readOnly,
  minHeight,
  registerRef,
}: {
  value: string;
  onChange: (next: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onFocus: () => void;
  onBlur: () => void;
  placeholder?: string;
  readOnly?: boolean;
  minHeight: number;
  registerRef: (el: HTMLTextAreaElement | null) => void;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const mirrorRef = useRef<HTMLDivElement | null>(null);

  // Measuring against a hidden mirror (instead of collapsing the field to
  // `auto`) keeps document height stable, so the page never jumps while typing
  // or backspacing. The scroll guard covers genuine one-line shrinks.
  useLayoutEffect(() => {
    const el = ref.current;
    const mirror = mirrorRef.current;
    if (!el || !mirror) return;
    const next = `${Math.max(minHeight, Math.ceil(mirror.getBoundingClientRect().height))}px`;
    if (el.style.height === next) return;
    const scroller = document.scrollingElement ?? document.documentElement;
    const prev = scroller.scrollTop;
    el.style.height = next;
    if (scroller.scrollTop !== prev) scroller.scrollTop = prev;
  }, [value, minHeight]);

  const typography = "w-full border-0 bg-transparent p-0 py-1 text-[16px] leading-[1.7]";

  return (
    <div className="relative">
      <div
        ref={mirrorRef}
        aria-hidden
        className={cn(
          typography,
          "pointer-events-none invisible absolute inset-x-0 top-0 whitespace-pre-wrap break-words",
        )}
        style={{ minHeight }}
      >
        {value ? `${value}\u200b` : "\u200b"}
      </div>
      <textarea
        ref={(el) => {
          ref.current = el;
          registerRef(el);
        }}
        value={value}
        readOnly={readOnly}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
        rows={1}
        className={cn(
          typography,
          "block resize-none overflow-hidden text-ink outline-none focus:outline-none focus:ring-0",
        )}
        style={{ minHeight }}
      />
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
