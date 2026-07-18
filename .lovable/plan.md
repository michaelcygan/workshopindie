## Suggested prompt bubbles for Today chat

Add a horizontal row of tappable "suggested message" chips just above the composer in the Group Today chat (the area circled in the screenshot). Tapping a chip pre-fills the composer with that text (focused, editable) so the user can send or tweak it — a low-friction nudge, not an auto-send.

### When they show
- **Empty state:** no messages in today's board yet.
- **Stale state:** the most recent message is older than ~45 minutes.
- Otherwise hidden, so an active chat isn't cluttered.

### Behavior
- Show 4–5 chips at a time, randomly sampled from the pool of 25, reshuffled each mount and each time the stale state re-triggers.
- Horizontally scrollable on mobile, wrap-friendly on desktop.
- Chips are city-agnostic (work across every group) — no `{city}` templating for v1.
- Tap → fills `TodayChat` composer textarea, focuses it, moves caret to end. No auto-send.
- Signed-out viewers don't see them (they already see the sign-in CTA).

### The 25 prompts (credible 2026 creative-scene talk)
1. Who wants to make a short film this month?
2. Photo walk today?
3. Looking for a scene partner to run lines this week
4. Anyone free to read a 10-page script tonight?
5. Need a second shooter Saturday — trade favors?
6. Coffee + co-writing session tomorrow morning?
7. Who's editing this weekend and wants company?
8. Open mic tonight — anyone going?
9. Need a composer for a 3-min short, small budget
10. Looking for an actor, mid-20s, one-day shoot
11. Anyone want to swap portfolio feedback?
12. Free studio time Thursday if someone needs it
13. Cyanotype / darkroom day — who's in?
14. Building a table read group, DM me
15. Want to jam? Bass + drums looking for a guitarist
16. Anyone shooting on 16mm this month?
17. Need a location scout partner for a Sunday drive
18. Looking for a colorist rec that isn't booked out
19. Who wants to hit a gallery opening tonight?
20. Free tickets to a screening tomorrow — first two DMs
21. Anyone up for a writer's room this week?
22. Need feedback on a 30-sec teaser cut
23. Looking to co-direct something small this summer
24. Zine trade — bring one, take one, this weekend
25. Sound mixer available Saturday if anyone's shooting

### Files to touch
- `src/components/group/group-today-tab.tsx` — inside `TodayChat`, add a `SuggestedPrompts` sub-component rendered between the messages scroller and the composer. Lift the composer's textarea value/ref up (or expose an `onPickPrompt` handler) so a chip tap can set the text and focus the input. Compute visibility from `posts` (empty OR `now - last.created_at > 45 min`).
- New file `src/lib/today-prompts.ts` — exports the 25-item array and a `sampleN(pool, n)` helper.

### Out of scope
- No new DB tables, no personalization, no per-city templating, no auto-send, no analytics.
- No changes to the expanded/fullscreen chat dialog beyond it inheriting the same `TodayChat` behavior automatically.
