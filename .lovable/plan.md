## Plan: persistent Workshop host control

Build one clear host control in the action row beside `Create a Collab`:

```text
[Claim Host] [Create a Collab]   // no host yet
[Host]       [Create a Collab]   // you are host; opens host settings
```

### What will change

1. **Replace the conditional host pill with a dedicated top action control**
   - Add a small `WorkshopHostAction` component or inline equivalent in `src/routes/workshop.$id.tsx`.
   - Render it immediately next to `Create a Collab`, in the exact space circled in the screenshot.
   - Keep it visible whenever the Workshop is active and not promoted.

2. **Use simple state rules**
   - If `room.host_user_id === current user`: show `Host`, wired to the existing host settings dropdown/menu.
   - If `room.host_user_id` is missing: show `Claim Host`, wired to the existing claim-host server action.
   - If another user is host: do not show the button; keep the hosted-by line/status behavior.
   - If a claim is already in progress: show a disabled/pending state such as `Claiming…` rather than disappearing.

3. **Fix the “not showing” root cause**
   - Do not depend on the smaller `ClaimHostPill` visibility/dwell logic for this primary control.
   - Keep the button rendered from the route-level room state, because that is the same row that owns `Create a Collab`.
   - After claiming, invalidate and refetch the room query so the button naturally changes from `Claim Host` to `Host` when the claim is finalized.

4. **Make `Host` the entry point to host settings**
   - Reuse the existing `HostMenu` dropdown when the viewer is host.
   - The label should be simply `Host`, not a separate “Hosting” status pill.
   - Host settings remain the existing controls: focus, rename, copy link, mute, transfer, lock, remove, end.

5. **Clean up duplicate/confusing host CTAs**
   - Remove or suppress duplicate host controls from the header/meta area where they compete with the main action row.
   - Keep the empty-state prompt only as secondary guidance, not the primary persistent action.

6. **Verify visually**
   - Open the live Workshop route at the current desktop viewport.
   - Confirm the top action row shows `Claim Host` directly next to `Create a Collab` when hostless.
   - Confirm after host state changes, the same location shows `Host` and opens the settings menu.