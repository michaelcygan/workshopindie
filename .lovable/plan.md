# Lounge chat "Links" tab + URL safety

Add a fourth tab, **Links**, alongside Chat / Gallery / Collabs in the live Lounge. It shows every URL shared in this Lounge's chat as a scannable, tappable card list. In the same pass, wire URL safety so hate-speech and adult domains can't be posted or displayed.

## What ships

### 1) "Links" tab in the Lounge

- Desktop: appears in `StageTabs` (`src/components/channel-view.tsx`) after Collabs, using the same `Link2` icon style as the other tabs.
- Mobile: appears in the `FullscreenRoom` bottom pill row (`src/components/media-panel.tsx`) after Collabs, with the same 44px tap-target treatment, and opens the existing bottom sheet with `"links"` preselected.
- Uses the chat message stream already loaded in `ChannelView` (`messages` state) — no new DB reads, no extra query. Renders live: any new chat message with a URL appears immediately.

### 2) Link card list

For each URL found in `messages.body` (deduped, newest first):

```
┌─────────────────────────────────────────────────┐
│ 🌐  example.com                                 │
│     "Here's the reference I mentioned…"         │
│     Alex · 2m ago                    [Open ↗]   │
└─────────────────────────────────────────────────┘
```

- Extract URLs from message bodies with a shared helper `extractUrls(body)` (regex based on the existing `URL_RE` in `src/lib/moderation/engine.ts`, exported once and reused).
- Each card shows: favicon (Google favicon service via hostname), hostname, one-line message snippet, sender display name + relative time, and an "Open" button that opens in a new tab with `rel="noopener noreferrer nofollow"`.
- Deduplicate by normalized URL (lowercase host + pathname); keep the earliest occurrence's context but a "shared N times" chip if it recurs.
- Empty state: "No links shared yet. Paste one in chat and it'll appear here."

### 3) URL safety — block bad domains on send and on display

- New file `src/lib/moderation/url-blocklist.ts` (browser-safe, no server imports): exports a curated `BLOCKED_HOSTS: Set<string>` and a `BLOCKED_HOST_SUFFIXES: string[]` covering:
  - Well-known adult sites (pornhub, xvideos, xhamster, redtube, youporn, onlyfans, chaturbate, stripchat, spankbang, etc.).
  - Known hate/extremist hubs (stormfront, dailystormer, kiwifarms, 4chan `/pol/` domain aliases, gab specifically for extremism-hosting subs, iron-march archives, etc.).
  - Common shortener wrappers that mask the above (`bit.ly` etc. are NOT blocked outright, but flagged for future expansion — no false positives shipped).
- Exports `isBlockedUrl(url: string): boolean` that normalizes host, strips `www.`, and matches exact host OR any suffix in `BLOCKED_HOST_SUFFIXES`.
- **Server enforcement** in `sendChatMessage` (`src/lib/chat.functions.ts`):
  - After the existing Zod parse, extract URLs from `data.body` and reject with a friendly error (`"That link isn't allowed in Lounge."`) if any match `isBlockedUrl`. Runs before the DB insert so blocked links never persist.
  - Keep the existing `moderateOrThrow` flow in place — this is an additive URL filter, not a replacement.
- **Client defense-in-depth** in the Links tab: filter out any URL where `isBlockedUrl(url)` is true, so legacy pre-block messages don't surface unsafe links.

### 4) Copy + polish

- Tab label: **Links**; icon: `Link2` from lucide-react.
- Sheet header title on mobile: "Links shared here".
- Toast on blocked send: `"Link blocked — this domain isn't allowed in Lounge."` (uses `toast.error` already used in the file).

## Scope guardrails

- No schema changes, no new tables, no new server functions beyond editing `sendChatMessage`.
- No changes to matching, media/WebRTC, presence, or the outer Lounge page.
- Desktop and mobile both get the tab; only the layout wrapping differs, matching the existing Chat/Gallery/Collabs pattern.
- Blocklist is a static curated list, not a live external feed — safe for edge runtime, no network at send time.

## Files edited

- `src/components/channel-view.tsx` — add "Links" to `StageTabs`, add `links` view mode branch, render `<LoungeLinks messages={messages} profileLookup={profileLookup} />`.
- `src/components/media-panel.tsx` — add "Links" pill + `mobileSheet === "links"` branch that renders the same component.
- `src/components/lounge-links.tsx` — **new**, presentational list of link cards with dedupe + empty state.
- `src/lib/moderation/url-blocklist.ts` — **new**, curated blocklist + `isBlockedUrl` + `extractUrls` helper.
- `src/lib/moderation/engine.ts` — export the URL regex (or re-export from the new helper) so there's one source of truth.
- `src/lib/chat.functions.ts` — call `isBlockedUrl` on extracted URLs before insert; throw a user-friendly error on match.
