
## Goal

Give the admin (`/admin/blog`) and member (`/me/blog/$id`) editors a single, polished "Markdown-light" writing experience for the article body — with Bold, Italic, Link dialog, and a safe Embed (YouTube/Vimeo → responsive iframe; other URLs → link card). Storage stays plain `body_markdown`; no schema changes; no rich-text framework.

## New file: `src/components/blog-body-editor.tsx`

Controlled component used by both editors.

```ts
type BlogBodyEditorProps = {
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
  onDirty?: () => void;
};
```

Contents:
- Editorial card wrapper: soft border, rounded-2xl, matching Workshop tokens.
- Header row: `Body` label + small `Markdown-light` chip + toolbar.
- Toolbar (buttons all `type="button"`, Lucide icons, `title` + `aria-label`):
  - Primary: **Bold** (`Bold`), **Italic** (`Italic`), **Link** (`LinkIcon`), **Embed** (`Youtube` or `Film`).
  - "More" dropdown (existing `DropdownMenu`): Heading 2, Heading 3, Quote, Bulleted list, Numbered list.
  - Mobile: `flex-wrap` + horizontal scroll fallback, min 36px tap targets.
- Textarea:
  - Controlled, `min-h-[520px] md:min-h-[560px]`, mobile `min-h-[360px]`, `resize-y`, generous padding, `leading-relaxed`, `focus:border-primary`, placeholder `Write your post…`.
  - Keyboard shortcuts on the textarea: `Cmd/Ctrl+B` → bold, `Cmd/Ctrl+I` → italic, `Cmd/Ctrl+K` → open link dialog.
  - Selection-aware wrap helper: if selection exists wrap it; if not, insert placeholder (e.g. `bold text`) and select it. Preserves existing `insertAtCursor` semantics.
- Footer row: word count + estimated reading time (≈220 wpm), plus muted help: *Use the toolbar to format text or add a link. Markdown is supported.*
- Every mutation calls `onChange(next)` and `onDirty?.()`.

### Link dialog
Uses shadcn `Dialog`. Fields: `Text`, `URL`. Prefills `Text` with current textarea selection when present. On submit:
- Trim URL; if missing protocol, prepend `https://`.
- Validate against `new URL()`; only allow `http:` / `https:`.
- Insert `[Text](url)` at selection; place cursor after insertion; refocus editor.
- Errors surface via `sonner` toast + inline field error.

### Embed dialog
Same `Dialog` primitive. Single URL field + short helper: *Paste a YouTube or Vimeo video, or add another URL as a link card.*
- Validate: `http:`/`https:` only. Reject `javascript:`, `data:`, malformed.
- Insert as its own line, surrounded by blank lines:
  ```
  \n\n[[embed:https://…]]\n\n
  ```
- No provider detection at insert time — renderer decides player vs. link card.

## New file: `src/components/blog-embed.tsx`

Pure client component `<BlogEmbed url={string} />`. Detects provider and renders:
- **YouTube** (`youtube.com/watch?v=`, `youtu.be/<id>`, `youtube.com/shorts/<id>`) → `https://www.youtube-nocookie.com/embed/<id>` in responsive `aspect-video` wrapper.
- **Vimeo** (`vimeo.com/<id>`) → `https://player.vimeo.com/video/<id>`.
- Iframe: `loading="lazy"`, `allowFullScreen`, `title` (e.g. `YouTube video`), `referrerPolicy="strict-origin-when-cross-origin"`, minimal `allow` (`accelerometer; encrypted-media; picture-in-picture; fullscreen`), rounded-2xl border.
- **Direct video** (`.mp4`, `.webm` on http/https) → native `<video controls preload="metadata" className="aspect-video …">`.
- **Fallback link card** (any other safe http/https URL): rounded card, `ExternalLink` icon, hostname on top, truncated path/URL below, `Open link`. `target="_blank" rel="noopener noreferrer nofollow"`.
- Invalid / unsafe URL → render a muted plain-text line `Unsupported embed` (no iframe).

## Update `src/components/blog-post-body.tsx`

Preserve today's shared `ReactMarkdown` config (image lightbox included). Add embed handling:
- Before feeding markdown to ReactMarkdown, split it into segments by scanning for lines matching `^\s*\[\[embed:(\S+?)\]\]\s*$` (multiline).
- Render an array: markdown chunks (each rendered via the current ReactMarkdown block, sharing the current `components` map so headings/images/lightbox behavior are identical) interleaved with `<BlogEmbed url={…} />`.
- Extract the current inline `ReactMarkdown` config into a small local `<MarkdownChunk markdown=…>` helper to avoid duplication.
- Image collection for the lightbox continues to scan the full raw markdown (embeds ignored), so behavior is unchanged for existing posts.
- No `rehype-raw`. No changes to image, list, heading, table, or link rendering.

## Update `src/components/blog-editor.tsx` (admin)

- Replace the current Body block (label + inline toolbar + textarea + helper) with:
  ```tsx
  <BlogBodyEditor value={body} onChange={setBody} />
  ```
- Delete the now-unused `insertAtCursor` helper and heading/quote/list/image toolbar buttons that live inline (their equivalents now live in the shared component's "More" menu; image-by-URL is dropped as a primary control per spec).
- Keep title / slug / excerpt / cover / SEO / attribution / save / publish / dirty tracking untouched.

## Update `src/routes/me.blog.$id.tsx` (member)

- Replace the raw `<textarea>` labeled `Body (Markdown)` (and its helper paragraph) with:
  ```tsx
  <BlogBodyEditor
    value={body}
    onChange={(v) => { setBody(v); setDirty(true); }}
    readOnly={readOnly}
  />
  ```
- Preserve all existing save/publish/unpublish/delete/permission/dirty logic. Preview tab unchanged (already uses `BlogPostBody`, which now understands embeds).

## Technical details

- No new npm packages. Uses existing `Dialog`, `DropdownMenu`, `Button`, `Input`, `Label`, `Tooltip`, Lucide icons, sonner.
- URL normalization: strip whitespace, prepend `https://` if no `://`, `new URL()` to validate, then `.protocol === 'http:' || 'https:'`.
- YouTube ID regex handles `?v=`, `youtu.be/<id>`, `/shorts/<id>`, `/embed/<id>`; strips extra params.
- Vimeo: match `/(?:vimeo\.com\/)(?:video\/)?(\d+)/`.
- Embed marker parsing regex (renderer): `/^[ \t]*\[\[embed:(\S+?)\]\][ \t]*$/gm`, split preserving order.
- Toolbar shortcuts registered via `onKeyDown` on the textarea only, so they don't hijack global keys.
- No DB migration, no server change, no changes to routing/authoring/attribution.
- `type="button"` on every toolbar/dialog action to avoid accidental submits.

## Acceptance check (manual)

Bold / Italic wrap selection or insert placeholder; `Cmd/Ctrl+B/I/K` work; link dialog inserts valid Markdown with auto-`https://`; YouTube / Vimeo URLs render as responsive players in Preview and public page; other URLs render as safe link cards; `javascript:` / `data:` never become iframes; existing posts (headings, lists, quotes, images, lightbox) render identically; admin + member share the same editor; mobile toolbar wraps and textarea does not overflow; no schema or dependency changes.
