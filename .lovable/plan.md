# Fix: message badge that can't be dismissed

## What's actually wrong

Confirmed by inspecting the database, not guessed:

- The envelope badge counts conversations that still have unread inbound messages.
- There are 5 unread messages in a single conversation, the newest from July 17 — nothing new arrived. That's why the badge points at an old thread.
- Opening the conversation calls the "mark as read" server function, but the database only allows the **sender** to update a message row (`sender updates own message`, `sender_id = auth.uid()`). There is no policy letting the **recipient** set `read_at`.
- So the update silently matches zero rows and returns no error. The badge can never clear — permanently stuck.

## The fix

1. Database migration: add an update policy on messages so the *other* participant in the conversation may mark inbound messages as read, restricted so they can only touch `read_at` on messages they did not send (recipient-only, scoped to conversations they belong to). Keep the existing sender policy intact, and add the matching `GRANT UPDATE` if it isn't already present.
2. Clear the stuck backlog: set `read_at` on the existing unread messages in that stale conversation so the badge drops to zero immediately instead of waiting for the user to reopen the thread.
3. Make the failure loud instead of silent: `markConversationRead` in `src/lib/dms.functions.ts` currently ignores the result. Return the number of rows updated and surface errors, so a future permission gap shows up rather than producing a phantom badge.
4. Client resilience in `src/components/messages-inbox-button.tsx`: after a successful mark-read, refresh the count immediately so the badge clears without needing a tab refocus.

## Verification

- Re-query unread messages after the migration — expect zero.
- Open the affected conversation as the recipient in a browser session and confirm the badge clears and stays cleared after a reload.
