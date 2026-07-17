## Three mobile issues from the IG browser session

### 1) Lounge shows "Lounge hit a snag" on mobile

We don't yet know which line threw — the error boundary swallows the message. Fix in two moves:

**a. Show the real error to us (temporarily).**
In `src/routes/lounge.$id.tsx` `LoungeErrorBoundary`, render `error.message` in small muted text under the copy so the next screenshot tells us the actual cause. Keep the console.error we already log. This alone unblocks diagnosis on the user's device without needing devtools.

**b. Harden the two most likely mobile-only culprits.**
- `getInstantRoom` is a `requireSupabaseAuth` server fn called from a public `/lounge/$id` route. On IG's in-app browser, storage/cookies can be flakier and the bearer sometimes isn't attached on the first fetch → 401 → thrown → boundary. Wrap the `useQuery` `queryFn` so a 401/"Unauthorized" returns `null` (route already handles `roomMissing` gracefully with the friendly NotFound instead of the scary boundary), and let the 5s refetch recover once auth hydrates.
- `use-media-room` reads `navigator`, `window.matchMedia`, `RTCPeerConnection` etc. IG's browser exposes these but WebRTC can throw on `new RTCPeerConnection` under some embedded WebViews. Guard the initial peer construction path with try/catch and surface a friendly "voice/video isn't available in this browser — open in Safari" instead of throwing up to the route boundary.

### 2) Mobile chat sheet is stuck small / unusable

Root cause in `src/components/media-panel.tsx` (~line 943): the sheet is `bottom-0 max-h-[85dvh]` with **no `min-h`** and its content is height-driven. With an empty transcript ("Quiet in here. Say hi.") it collapses to ~120px and the composer input row is off-screen behind the mobile-nav island (`bottom-3 z-50`), so the panel looks frozen.

Fix:
- Give the sheet a real height, not just a cap: `h-[85dvh] max-h-[85dvh]` (or `min-h-[70dvh]`).
- Add bottom padding equal to the mobile-nav island height (~76px) so the composer input clears the nav: `paddingBottom: calc(env(safe-area-inset-bottom) + 84px)`.
- Ensure `ChatPanel` uses `flex flex-col flex-1 min-h-0` and its message list is `flex-1 overflow-y-auto` so the composer always pins to the bottom.

Optional polish: make the top drag-handle actually drag-to-dismiss via a small framer-motion `drag="y"` with `dragConstraints={{ top: 0, bottom: 0 }}` and an `onDragEnd` that closes when `info.offset.y > 80`. Cheap, matches the visual affordance.

### 3) Home "bottom island" nav buttons don't respond

The mobile-nav island (`fixed bottom-3 z-50`) sits visually above the CTA grid, but the "Post a Collab" `<Link>` card is a big tap target (`min-h-[180px]`, full width) that extends up to and behind the nav. On iOS Safari / IG WebView, when a fixed element is `bg-background/90 backdrop-blur-md` and the underlying `<Link>` has `hover:-translate-y-0.5`, the touch can land on the transformed card first and swallow the tap on the nav pill.

Fix in `src/routes/index.tsx`:
- Add safe bottom padding to the page so cards never sit under the nav island on mobile: wrap the hero section or main with `pb-[calc(env(safe-area-inset-bottom)+96px)] md:pb-0`.
- Remove `hover:-translate-y-0.5` on touch devices for the CTA `<Link>` cards (Tailwind `md:hover:-translate-y-0.5` — transforms create a new stacking context that can eat taps on iOS).

Belt-and-suspenders in `src/components/mobile-nav.tsx`:
- Bump the outer wrapper to `z-[60]` so it always wins the hit-test against transformed cards.
- The wrapper is a plain `div` — leave it `pointer-events-auto` (default) but explicitly set it to avoid inheriting a `pointer-events-none` from any ancestor.

### Verification

- After the boundary shows the real error, follow up with a quick targeted patch (likely the auth-null fallback in 1b).
- Reload `/` on mobile viewport → nav pill taps navigate to Home/Lounge/Collabs/Groups/You.
- Open a Lounge → tap Chat → sheet fills ~85dvh, composer visible above the nav island, typing works.
