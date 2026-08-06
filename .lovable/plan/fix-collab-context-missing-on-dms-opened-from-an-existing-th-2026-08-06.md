# Fix: collab context missing on DMs opened from an existing thread

## What's happening

When someone submits a freeform "Suggest how you can help" (or a role application), the server helper that opens the DM thread sets `context_collab_post_id` **only when it creates a brand-new conversation**. If the two accounts had ever DM'd before, the existing conversation is reused untouched, so:

- the DM inbox row shows no "Re: <collab title>" chip and the conversation is missing from the Collabs tab filter,
- the thread header shows no link back to the collab.

That matches the reported case: the two test accounts already had a message history.

## Plan

1. **Attach context on reuse.** In `openCollabDmThread` (`src/lib/collab.functions.ts`), after finding an existing conversation, update it to point at the current collab when its `context_collab_post_id` is empty or points at a different collab. New conversations keep today's behavior.
2. **Make the opening message self-describing.** Prefix the seeded message with a short, plain-language context line naming the collab and whether it's a role application or a suggestion, so the context survives even if the header chip is later re-pointed by a newer collab. Keep the applicant's own text intact below it.
3. **Same fix for the guest-claim path**, which shares the same helper — no extra work, just verify.
4. **Verify end to end.** Using two accounts that already have a DM history, submit a freeform suggestion and confirm: the inbox row shows "Re: <collab title>", the conversation appears under the Collabs tab, and the thread header links to `/collab/<slug>`.

## Technical notes

- Single file change: `src/lib/collab.functions.ts` (helper `openCollabDmThread`). Writes go through the admin client already used there, so RLS is not a blocker.
- No schema migration required — `conversations.context_collab_post_id` already exists and is read by both `src/routes/dms.index.tsx` and `src/routes/dms.$conversationId.tsx`.
- Existing older conversations stay as-is; they pick up context the next time an application or suggestion is sent through them.
