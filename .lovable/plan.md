# Mobile-only refinement: Lounge selector + active Lounge room

Scope: mobile only (`< md`). Desktop (`md+`) stays byte-equivalent. No new components, no new queries, no schema/media/presence changes. Reuse existing primitives.

Files touched:
- `src/routes/lounge.index.tsx` — responsive layout on the selector.
- `src/components/live-topics-list.tsx` — remove fixed 420px scroller on mobile.
- `src/components/channel-view.tsx` — mount the existing `FullscreenRoom` as the default mobile shell.
- `src/components/media-panel.tsx` — extend the existing mobile chat sheet into a Chat / Work / Collabs sheet + safe-area dock.
- `src/components/live-workshops-rail.tsx` — light padding pass, no logic change.

Nothing new is created; the pieces the brief lists (`FullscreenRoom`, `VideoStage`, `StageTabs`, `RoomGallery`, `WorkshopCollabsPanel`, `WorkshopPresenceWorksRail`, `WorkPeek`, `ProfilePeek`) stay authoritative.

---

## 1. Lounge selector (`/lounge`)

**Problem:** the route forces `LiveTopicsList layout="split"`, and split has a `style={{ height: 420 }}` inner scroller. On phones the featured column stacks on top and the topic list becomes a small, nested scroll region.

**Change (mobile only, no data changes):**

- In `src/routes/lounge.index.tsx`, render two copies of `LiveTopicsList` inside a single wrapper — one `md:hidden` with `layout="stack"`, one `hidden md:block` with `layout="split"`. Both consume the same `busy`, `disabled`, `onLiveCountChange`, `onLiveByMediumChange`, and `onPick*` handlers already on the page. The shared `useQuery(["instant-active-rooms"])` inside the component dedupes automatically, so this does not double-fetch.
- The stack layout already renders the "Lounge" featured block, prompt/topic list, `featuredFooter`, and CTA — reuse it as-is with the same `featuredFooter={<RoomPromptMarquee …/>}`.
- In `src/components/live-topics-list.tsx`, remove the `style={{ height: 420 }}` inner scroller from the split layout at `< md` widths only (guard the height style behind `md:` via inline media, or keep the fixed height only when the parent renders it). The stack layout already lets the page scroll naturally.

Hierarchy on mobile (top → bottom):
1. Compact header (already exists): back, "Lounge", live dot + count, mic/cam toggles.
2. One-line subtitle + optional 24h recap chip (already exists).
3. Rejoin pill / first-visit / idle nudge (already exist).
4. `LiveTopicsList layout="stack"` — featured Lounge, primary "Drop In" CTA, topics with live counts and participant avatars, prompt marquee inline as `featuredFooter`.
5. `LiveWorkshopsRail` — active rooms as tappable cards (already renders as rows; ensure horizontal padding matches surrounding blocks: `px-1` inner, and no `overflow-x` clipping on 320–430px).
6. Host strip (secondary): keep the existing `flex-col sm:flex-row` layout, but on mobile promote clarity — the input becomes full-width `h-11` (44px tap target), the "Open the Lounge" button is `w-full`, wrapped on its own line. Camera stays optional (already: `canDrop = effMic || effCam`).

Camera-optional copy stays put; the toast already says "Connect a mic or camera to continue."

---

## 2. Active Lounge room (`/lounge/:id`)

**Problem:** `ChannelView`'s default surface is the desktop 2-column grid (`mt-4 grid md:grid-cols-[1fr_260px]`). On mobile the grid becomes a single column with the *tall* chat block on top and `MediaPanel` (participants, mic/cam controls) pushed way below. Panels use `h-[60vh]` and cause nested scrolling and clipping.

**Change (mobile only):**

The existing `FullscreenRoom` in `media-panel.tsx` is already a stage-first, safe-area-friendly full-viewport shell with a fixed dock, a mobile chat sheet, and — critically — accepts `collabsSlot` and `gallerySlot`. Today it is only rendered when the user hits the desktop fullscreen expand button (`fsView === "chat"`). We'll flip its default to *on* at `< md` and *off* at `md+`, reusing the exact same props already wired at `src/components/channel-view.tsx:749–823`.

Concrete edits in `channel-view.tsx`:
1. Add `const isMobile = useIsMobile()` (hook already exists at `src/hooks/use-mobile.tsx`).
2. `fsView` init: `useState<null | "chat" | "gallery">(isMobile ? "chat" : null)` and re-sync in an effect when `isMobile` changes so a resize back to desktop drops the fullscreen shell. This mounts the *same* `FullscreenRoom` instance that already receives `chat / collabs / gallery` slots — no second `useMediaRoom`.
3. Wrap the desktop layout block (`<div className="mt-4 grid …">…`) in `<div className={cn(isMobile && "hidden")}>` so it stops rendering on mobile. `MediaPanel`, chat scroller, and the `h-[60vh]` regions belong to that block, so their nested-scroll and clipping issues disappear on mobile.
4. The desktop expand-button-to-fullscreen behavior remains untouched (`md+` renders as before; fullscreen expand still works).

Concrete edits in `media-panel.tsx` (inside `FullscreenRoom`):
5. Promote the current mobile "Chat" sheet toggle into a segmented **Chat / Work / Collabs** control. Reuse the existing `SideSeg` component. On mobile, the top-bar button opens a bottom sheet whose contents switch between `messages` (existing `ChatPanel`), `gallerySlot`, and `collabsSlot`. Label the Gallery slot as "Work" on mobile (visible label only — internal names, DB, and desktop labels stay "Gallery"). Only one sheet is open at a time (this matches the brief).
6. Container becomes `h-[100dvh]`, and the floating dock + reactions tray + sheet all switch to `pb-[max(0.75rem,env(safe-area-inset-bottom))]` so iOS home indicator and the mobile keyboard don't clip controls. The sheet uses `max-h-[85dvh]` with an inner flex column: header (drag handle + tabs), scrollable body, then the `ChatMentionInput`/`ChatPanel` composer pinned at the bottom. When the keyboard opens, the sheet re-lays inside `100dvh` and the composer stays visible.
7. Dock on mobile: `Mic`, `Camera`, `Next/Hop` (`dockExtra` already passes `HopButton`), `Exit`. Screen share, PiP, and Fullscreen collapse into a single "More" overflow (a small popover using shadcn `Popover` we already import) rendered next to the layout segmented control in the top bar. Screen share stays functional through the same handler already living in `channel-view.tsx`; we just move the button's *visual* placement on mobile. On unsupported browsers the entry stays disabled with the current title copy.
8. "Here now" strip on mobile: a horizontal row of tappable avatars (reusing `ProfilePeek` — already imported by `media-panel.tsx`) rendered directly under the top bar, above the video stage. Compact `-space-x-2` avatars for up to 5 members; overflow shows `+N`. Zero new queries; feed from the same `others` prop already passed in.
9. Add `role="dialog" aria-modal="true"` only when the sheet is open, so screen readers behave correctly with the video stage behind it.

Camera-off path: `VideoStage` and the audio tiles already render `AudioTile` when there is no local video — no change needed. Media-permission-denied path: `media.error` already routes the user back to `/lounge` (existing effect at ~L212).

Empty Work/Collabs: existing `RoomGallery` and `WorkshopCollabsPanel` render their own empty states; the sheet just hosts them. Long chat history: `ChatPanel` already uses `scrollRef` with auto-scroll; that keeps working.

---

## 3. Design guardrails (applied inline)

- 44px minimum: dock buttons `h-11 min-w-11`, sheet tab buttons `h-11`, host input `h-11`.
- `100dvh` + safe-area: `FullscreenRoom` wrapper + sheet + dock only (desktop uses today's chrome).
- No horizontal overflow: audit `LiveWorkshopsRail`, host strip, and the "Here now" strip at 320px with `min-w-0` on flex children and `overflow-x-hidden` on the root main.
- Selected / unread: sheet tabs use existing `SideSeg` `active` variant; unread chat count = `messages.length - lastSeenLenRef` shown as a small dot on the Chat tab (state lives inside `FullscreenRoom`, reset when the sheet opens on Chat).
- Landscape: the `100dvh` shell + `flex` stage handle it; verify no fixed heights leak in.

---

## 4. Verification (manual checks at 320 / 375 / 390 / 430 px)

- `/lounge`: featured Lounge → Drop In → topics → active rooms → host strip; no nested scrollers; camera-disabled state shows correct "no mic/cam" strip and Drop-In disables.
- `/lounge/:id` on mobile: `FullscreenRoom` mounts by default, stage visible above the fold, presence strip shows peers, sheet opens with Chat/Work/Collabs tabs, composer visible with keyboard open, exit/hop/mic/cam land in the bottom dock, screen share reachable via the overflow.
- Desktop (`md+`) unchanged at 1024/1280.
- No new instances of `useMediaRoom`; only the existing single call in `ChannelView`.
- `bun x tsgo --noEmit` clean.

## Files edited

- `src/routes/lounge.index.tsx`
- `src/components/live-topics-list.tsx`
- `src/components/channel-view.tsx`
- `src/components/media-panel.tsx`
- `src/components/live-workshops-rail.tsx` (padding only)
