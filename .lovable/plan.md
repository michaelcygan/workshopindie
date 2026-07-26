Fix: logged-out users tapping the "+" composer currently get bounced to `/login` (and — because the login route echoes its `redirect` param — into the nested redirect loop we've seen in the address bar). Make the composer open like it does for signed-in users, and defer auth until they pick an action.

Changes (frontend only):

1. `src/components/mobile-island/mobile-action-island.tsx`
   - Remove the `if (!user) navigate('/login')` short-circuit in `onComposerToggle`; always toggle `composerOpen`.
   - Pass `isAuthed={!!user}` to `<MobileComposerMenu />`.

2. `src/components/mobile-island/mobile-composer-menu.tsx`
   - Accept `isAuthed: boolean`.
   - In each action's `onClick`: close the menu; if `isAuthed`, navigate to `action.to`; otherwise navigate to `/login` with `search: { redirect: action.to }` so they land on the intended create page after signing in. Use a plain string for `redirect` (no pre-encoding — that's the source of the ever-growing `%2525…` chain).

No changes to auth logic, the login route, or other surfaces.
