## 1. Shorten the Lounge chat window

The chat pane currently clamps to `h-[clamp(320px,46vh,560px)] xl:h-[60vh]`. When cameras are on, `46vh`/`60vh` still grows the pane too tall on laptops. Tighten it.

**`src/components/channel-view.tsx`** — replace all 5 occurrences of the clamp class:
- From: `h-[clamp(320px,46vh,560px)] xl:h-[60vh]`
- To: `h-[clamp(280px,38vh,440px)] xl:h-[52vh]`

Applies to the Chat, Gallery, Collabs, Links, and composer scroll containers so the panel height stays consistent across tabs.

## 2. Normalize bare URLs in chat (clickable + Links tab + moderation)

Today only `https?://` URLs are detected. Pasting `www.instagram.com` or `instagram.com/foo` renders as plain text, doesn't appear in Links, and bypasses the blocklist.

### A. Shared URL extraction — `src/lib/moderation/url-blocklist.ts`

- Add a second regex for bare URLs:
  - `www.` prefix, or a hostname with a known TLD, followed by optional `/path?query#frag`.
  - Practical shape: `\b(?:www\.[^\s<>()"']+|(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>()"']*)?)`
- Update `extractUrls(body)` to return **normalized absolute URLs**: if the match lacks a scheme, prepend `https://`. Keep trimming trailing `),.;!?`.
- Skip matches whose "hostname" doesn't parse via `new URL(...)` after normalization (avoids catching things like `hello.world` in prose — require a real TLD via a small allowlist of length ≥ 2 and reject if `URL` construction throws).
- `findBlockedUrl` / `isBlockedUrl` then automatically cover bare URLs since they get normalized upstream.

### B. Chat rendering — `src/components/chat-mention-input.tsx`

In the `ln` component's parser (around line 219):
- Replace the single `urlRe` pass with two passes: one for `https?://…` (unchanged), one for bare URLs matching the same pattern as in (A).
- For bare matches, produce `{ type: "link", text: rawMatch, href: "https://" + rawMatch }` so the visible text stays as typed but the anchor points to the normalized URL.
- Guard against overlap with existing hits (mentions, markdown links) using the existing `hits.some(...)` check.

### C. Links tab — `src/components/lounge-links.tsx`

No change needed: it consumes `extractUrls`, which will now return normalized `https://…` strings for bare URLs. Dedup key and favicon fetch continue to work.

### D. Moderation on send — `src/lib/chat.functions.ts`

No change needed: `findBlockedUrl` calls `extractUrls`, so `instagram.com/hate-site-x` typed without a scheme is now caught by the same blocklist.

### Verification

- Type `www.instagram.com` in Lounge chat → renders as clickable link, opens `https://www.instagram.com`, appears in the Links tab.
- Type `pornhub.com` (no scheme) → send is rejected by the blocklist.
- Existing `https://…` links continue to work and are not double-linkified.
- Chat pane on a laptop stays shorter with camera tiles visible above.
