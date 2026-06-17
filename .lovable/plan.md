# Media Player tool — plan

A new chip in the Workshop Tools Panel ("Player") that lets anyone in the room paste links from approved streaming sites and play them inline. Each item joins a shared playlist that follows the same lifecycle as every other tool: session-only inside an instant room, automatically persistent if the room is forked into a Workshop. Playback is independent per viewer.

## Scope

- Workshop-tool-only — not a standalone route, no homepage surface.
- Reuses existing `workshop_tool_items` / `instant_tool_items` storage (no schema change), exactly like Pinboard/List/Drive — so persistence "follows the Workshop flow" automatically.
- Reuses `EmbedPlayer` and its provider/HLS detection.

## UX

```
Player                                                  + Add link
────────────────────────────────────────────────────────────────────
[ Big embed of currently-selected item ]
  Now playing · "Title" — added by @alice · YouTube

Queue
 ▸ 1. YouTube — Skate edit (alice)            [play] [open] [×]
 ▸ 2. SoundCloud — vibe demo (sam)            [play] [open] [×]
 ▸ 3. Spotify — reference album (sam)         [play] [open] [×]
```

- "+ Add link" opens an inline row: paste URL → on submit we parse provider, validate against allowlist, store a row with `tool_type='player'`, `url`, optional `title` (derived from `extractWorkFromUrl` oEmbed if available, otherwise hostname).
- Clicking a queue row sets it as the local "now playing" (client state only — independent per viewer, as requested).
- Auto-advance to the next item when an HTML5/HLS video ends; iframe providers (YouTube/Vimeo/etc.) get a manual "Next" button since cross-origin iframes don't fire `ended`.
- Item author or workshop host can delete; everyone else can only play/open.
- Empty state: "Drop a link from YouTube, Vimeo, SoundCloud, Spotify, Bandcamp, Apple Music, TikTok, Instagram, Threads, X…" with a single input.

## Provider allowlist (expanded, international)

Extend `ALLOWED_HOSTS` and the provider/embed builders in `src/components/embed-player.tsx` + `src/lib/works-import.functions.ts`:

- Video: YouTube, Vimeo, TikTok, Dailymotion, Twitch (clips + videos), Loom, Wistia, Bilibili, Niconico, Facebook video, Instagram Reels, Threads, X / Twitter
- Music / audio: SoundCloud, Spotify, Bandcamp, Apple Music (embed.music.apple.com), Deezer, Mixcloud, Audius, Tidal (embed.tidal.com), YouTube Music
- Long-form / talks: Vimeo Showcase, TED (embed.ted.com)

Each provider gets:
1. Hostname in `ALLOWED_HOSTS`
2. `buildEmbedUrl` case that converts the canonical URL to its `/embed/...` form
3. A short `providerLabel` mapping

Anything not on the allowlist is rejected with a friendly toast ("This site isn't supported yet — try YouTube, SoundCloud…").

## Persistence model (no schema change)

- Instant room: rows live in `instant_tool_items` (`tool_type='player'`, `url`, `title`, `body` = provider id). RLS already restricts to room members.
- Persistent workshop (forked from a room or created directly): same rows but in `workshop_tool_items`. The existing fork pipeline copies tool items, so the playlist follows the workshop automatically.
- No new RLS, no new tables, no GRANTs needed.

## Sync

Independent per viewer. Adding/removing items uses the existing react-query invalidation that the tools panel already does, so the queue list updates for others within a few seconds — but each viewer chooses what's playing locally.

## Files

- `src/components/workshop-tools-panel.tsx` — register `player` in `PRESETS`, `TOOL_ORDER`, `ShippedToolType`; add `PlayerTool` render branch.
- `src/components/workshop-player-tool.tsx` — new: queue UI + current `EmbedPlayer` + add-link row + delete affordance.
- `src/components/embed-player.tsx` — expand `ALLOWED_HOSTS`, add `providerLabel` entries, broaden `providerFromUrl`.
- `src/lib/works-import.functions.ts` — extend `detectProvider` + `buildEmbedUrl` for new providers (so we can derive titles via oEmbed where available; falls back to OG scrape, then hostname).

## Out of scope (call-outs)

- No host-synced playback. Can be added later via Supabase realtime broadcast on the `instant_rooms` channel.
- No uploads of raw video files. (Cloudflare Stream uploads stay in the Recorder/Drive tools.)
- No cross-room "saved playlists" library. Playlist == tool items of the current room/workshop.
