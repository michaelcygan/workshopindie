## Goal

Expand the Workshop Topic rail with 7 new options so the now-roomier scroll has more reasons to drop in. "Office Hours" becomes the application-style "ask the host a question" room.

## New Topics

| Topic | Use it for |
| --- | --- |
| Office Hours | Drop-in to ask a specific question of the host. Application-style 1:1s and small Qs. |
| Pitch | Practice a pitch, logline, or elevator description and get reactions. |
| Roundtable | Topic-led discussion (e.g. "AI in scoring", "self-distribution"). |
| Listen Party | One person shares finished work; everyone reacts together. |
| Open Mic | Take turns performing — comedy, music, poetry. |
| Jam | Improv/sketch session — no goal, just make something with whoever shows up. |
| Stand-up | Quick check-in: what you're on, what's blocking you. |

Order in the rail (after the existing ones): Office Hours, Roundtable, Pitch, Listen Party, Open Mic, Jam, Stand-up.

## Changes

**1. DB migration — add enum values**

```sql
ALTER TYPE public.category ADD VALUE IF NOT EXISTS 'office_hours';
ALTER TYPE public.category ADD VALUE IF NOT EXISTS 'pitch';
ALTER TYPE public.category ADD VALUE IF NOT EXISTS 'roundtable';
ALTER TYPE public.category ADD VALUE IF NOT EXISTS 'listen_party';
ALTER TYPE public.category ADD VALUE IF NOT EXISTS 'open_mic';
ALTER TYPE public.category ADD VALUE IF NOT EXISTS 'jam';
ALTER TYPE public.category ADD VALUE IF NOT EXISTS 'standup';
```

**2. `src/lib/categories.ts`**
- Extend `Category` union with the 7 new ids.
- Append entries to `CATEGORIES` in the order above.
- Add the same ids to `categoryClass` map pointing at new `cat-*` tokens.
- Keep `WORK_CATEGORY_IDS` unchanged — none of the new topics are publishable Works (matches how Critique / Business of Art / Co-working already behave).

**3. `src/styles.css` — color tokens**

Add semantic OKLCH pairs that fit the existing soft-bg + saturated-ink scheme. Distinct hues from the eight current ones:

```css
--cat-office_hours: oklch(0.93 0.05 280);  /* lavender */
--cat-office_hours-ink: oklch(0.40 0.16 290);
--cat-pitch:        oklch(0.93 0.06 30);   /* coral */
--cat-pitch-ink:    oklch(0.42 0.18 30);
--cat-roundtable:   oklch(0.93 0.05 200);  /* teal */
--cat-roundtable-ink: oklch(0.38 0.14 205);
--cat-listen_party: oklch(0.93 0.06 330);  /* magenta */
--cat-listen_party-ink: oklch(0.42 0.18 335);
--cat-open_mic:     oklch(0.93 0.06 15);   /* warm red */
--cat-open_mic-ink: oklch(0.42 0.18 20);
--cat-jam:          oklch(0.93 0.06 100);  /* chartreuse */
--cat-jam-ink:      oklch(0.42 0.16 110);
--cat-standup:      oklch(0.93 0.05 250);  /* periwinkle */
--cat-standup-ink:  oklch(0.40 0.16 260);
```

Plus matching `--color-cat-*` aliases in the Tailwind v4 `@theme` block so `bg-cat-pitch` etc. resolve.

**4. Verify downstream usage**
Confirm by searching: anywhere that switches on `Category` (e.g. RoomPromptMarquee, LiveTopicsList, topic-prompts, badges) doesn't crash on the new ids — most spots iterate `CATEGORIES`, but the topic-prompts file has hard-coded prompt copy per category and may need a fallback if it's keyed by id. I'll add minimal placeholder prompts for the new topics in the same edit if needed.

## Out of scope

- Iconography per topic (current rail is label-only).
- Promoting any new topic to a publishable Work category.
- Host-specific configuration for Office Hours beyond the topic existing (no application gating in v1 — that's a follow-up if you want a Calendly-style sign-up like the Lineup event type).

## Files touched

- `supabase/migrations/<new>.sql` (enum additions)
- `src/lib/categories.ts`
- `src/styles.css`
- `src/lib/topic-prompts.ts` (if keyed by category id — adds short prompt copy for the 7 new topics)
