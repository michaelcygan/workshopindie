## Goal

Tighten the "Post a Collab" flow so it's branded, scoped to creative mediums, and offers an instant "drop into a Workshop now" path in addition to (or instead of) scheduling.

---

## 1. Category — drop non-medium options

A Collab becomes a Work, so only WORK_CATEGORY mediums apply.

- In `src/routes/collab.new.tsx`, replace `CATEGORIES` with `WORK_CATEGORIES` from `src/lib/categories.ts` (Film, Music, Writing, Build, Visual).
- Remove Critique, Business of Art, Co-working from the chip row.
- Default `category` stays `"visual"` (already a Work category).

## 2. Branded copy

- H1 "Post a call" → **"Post a Collab"**.
- Subtitle: **"Share what you're making and the roles you need. People reach out — you pick your team."**
- Submit button "Post call" → **"Post Collab"**.
- "Cancel" stays.
- Toast "Posted to the Collab Board" → **"Your Collab is live."**
- Toast "Posted — your Workshop is scheduled." → **"Collab posted. Your Workshop is on the calendar."**

## 3. Replace the "Set a time" block with a three-mode Workshop chooser

Today the block only offers Schedule. Make it a clearer set of three options the user picks after the rest of the form:

```text
Pair this Collab with a Workshop
( ) Not yet — just post it
( ) Open a Workshop right now — meet people, brainstorm, start casting
( ) Schedule a Workshop — pick a time and let people RSVP
```

Render as three stacked radio-style cards inside the existing dashed section. Replace icon + title + helper text per option:

- **Not yet** — "Post the Collab on its own. You can open a Workshop on it any time."
- **Open one now** — "Spin up a live Workshop on this Collab the moment you post. Up to 5 seats. Meet collaborators, brainstorm the idea, audition roles on the spot."
- **Schedule one** — "Pick a date and time. People who apply get the invite and can RSVP. They drop in when it starts."

When **Schedule** is selected, show the existing `datetime-local` input plus the no-show helper.
When **Open one now** is selected, show a small reassuring line: *"After you post, we'll drop you straight into the Workshop."*

Replace the section heading "Set a time for a live Workshop on this" with **"Workshop on this Collab"**.

Replace existing description "Pick a time and we'll schedule a room on this Collab. People RSVP, then drop in when it starts." — it's only shown under the Schedule option now (see above).

## 4. Submit-handler changes

State shape: replace `scheduleOn: boolean` + `scheduledAt: string` with:

```ts
type WorkshopMode = "none" | "now" | "scheduled";
const [workshopMode, setWorkshopMode] = useState<WorkshopMode>("none");
const [scheduledAt, setScheduledAt] = useState<string>("");
```

In `onSubmit`, after the Collab + roles insert:

- `workshopMode === "scheduled"` — existing scheduled-Workshop insert (unchanged).
- `workshopMode === "now"` — call the existing `openWorkshopOnCollab` server fn with the new Collab's id. On success navigate to `/instant/$id` (the paired room id) instead of the Collab detail page. Toast: **"Your Workshop is live — say hi."**
- `workshopMode === "none"` — current behavior; navigate to `/collab/$slug`.

`openWorkshopOnCollab` already does all the work (creates Workshop, paired room, host participant, applicant notifications, idempotent). No server-side changes needed.

## 5. Small additional optimizations (same flow, low risk)

1. **Roles UX** — current default `"Collaborator"` is generic. Change the initial role placeholder to `""` with placeholder text only, AND add a quick chip strip above the roles list with one-tap presets per selected category (e.g. Music → Vocalist, Producer, Mixer; Film → DP, Editor, Actor; Writing → Co-writer, Editor; Build → Designer, Engineer; Visual → Photographer, Model, Stylist). Tapping a chip appends a role row pre-filled with that name. Keeps the form fast for first-time posters.
2. **Description placeholder** — keep but trim to: *"What you're making, the vibe, what's already done, and what 'great' looks like."*
3. **"How should people reach you"** — rename to **"How people contact you"** and reorder so "In-app message" is recommended (already default). No logic change.
4. **Compensation** label → **"Pay"** with helper text under it: *"Set expectations up front — it makes better matches."* (small, `text-xs text-ink-muted`).
5. **Where** — leave logic, but rename "Online / In person / Hybrid" copy to **"Remote / In person / Either"** (matches how people actually talk).

These are copy/UX-only and don't touch the schema or server functions.

## Files touched

- `src/routes/collab.new.tsx` — all of the above.

No DB migration, no server function changes, no RLS changes.

## Acceptance

- Category row shows only Film, Music, Writing, Build, Visual.
- Header reads "Post a Collab".
- Workshop section offers three explicit options; "Open one now" posts the Collab and drops the user into the live Workshop room.
- Scheduling still works exactly as before when picked.
- Role presets appear contextually under the selected category.
