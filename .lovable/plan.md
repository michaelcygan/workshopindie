## Discovery
Everything the request needs already exists:

- **DB gate** (`public.can_dm` RPC): mutual follow OR collab allowance OR workshop host↔participant OR target has `dm_policy = 'everyone'`; blocks and `dm_policy = 'nobody'` deny.
- **Settings UI** (`src/routes/settings.tsx`): user can pick `mutuals` / `everyone` / `nobody`. "Open DMs" opt-in = `everyone`.
- **`MessageButton`** (`src/components/message-button.tsx`) already calls `checkCanDm` and is rendered on the profile (`src/routes/u.$username.tsx` line 549) next to Follow / Share / Report / Block.

The one gap vs. the ask: today `MessageButton` renders even when `canDm === false` as a **disabled** button with a "follow each other" tooltip. The user wants it to be visible **only** when DMs are actually possible — so it becomes a real signal of "you can DM this person right now."

## Change
**File:** `src/components/message-button.tsx`

Replace the disabled-with-tooltip fallback with an early `return null` whenever `canDm !== true` (still returns `null` for self / signed-out, unchanged).

Effect:
- Mutual followers → button appears next to Follow on the profile header.
- Target has `dm_policy = 'everyone'` (open DMs opt-in) → button appears for any signed-in viewer.
- Otherwise (not mutual, target on `mutuals`/`nobody`, blocked, self, or signed-out) → button is hidden entirely.

Placement stays where it is (profile action row alongside Follow / Share) — that's the natural spot and matches the screenshot.

## Scope
- One file changed (`message-button.tsx`).
- No schema, RPC, settings, or profile-layout changes.
- Removes now-unused Tooltip imports in the same edit.
