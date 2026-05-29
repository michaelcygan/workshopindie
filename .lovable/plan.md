Center the medium category filters on the Collab board (desktop only).

Change in `src/routes/collab.index.tsx` at the `CategoryScroller` usage (~line 248): add `className="justify-center"` so the desktop flex-wrap row centers its chips. Mobile is unaffected (it uses the auto-scrolling track, which ignores `justify-*`).

No other call sites of `CategoryScroller` are touched.