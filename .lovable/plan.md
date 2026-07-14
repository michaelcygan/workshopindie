## Diagnosis

The Lounge has multiple auto-close paths, and one is very likely causing the “closed after a minute or two” behavior:

- The client has a “quiet” guard: if a user is muted and camera-off, it warns after 2 minutes and drops them 1 minute later.
- The backend presence slot claim sweeps presence rows after only 60 seconds.
- Older database triggers/jobs can archive a Lounge when the last presence row is deleted, which can happen during cleanup/unmount/reconnect flows.
- The Lounge page then redirects non-host users whenever the room status becomes non-active, showing “This Lounge ended.”

## Implementation plan

1. **Make Lounge presence more forgiving**
   - Increase the live-presence stale window from 60 seconds to a safer grace period, so a missed heartbeat or brief tab/network pause does not make the room look empty.
   - Update the Lounge slot-claim cleanup so it does not delete a participant after only 60 seconds.

2. **Stop accidental archiving from normal exits/reconnects**
   - Replace any “archive immediately when last presence leaves” behavior with the newer emptied-at grace lifecycle.
   - Keep real manual endings intact: the named Lounge owner can still explicitly end the Lounge.

3. **Add/adjust the “Keep going?” warning before any idle drop**
   - Change the quiet-state popup copy to “Keep going?”
   - Make the idle window more forgiving than the current 2-minute warning + 1-minute drop.
   - “Keep going” will reset/dismiss the warning without closing the Lounge.

4. **Make the route handling less confusing**
   - If the room is truly manually ended, keep the “This Lounge ended” path.
   - If the room was only archived/stale, avoid messaging it as if someone ended it, and route users back more gracefully.

5. **Verify the flow**
   - Check the Lounge no longer closes from a short idle period.
   - Confirm manual “End” still works.
   - Confirm leaving/hopping still removes presence without causing premature closure for others.