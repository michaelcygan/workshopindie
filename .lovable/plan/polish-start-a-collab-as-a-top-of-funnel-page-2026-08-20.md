# Polish /start-a-collab as a top-of-funnel page

The page works but reads thin for someone who has never heard of Workshop. This adds explanatory writing, a clearer visual rhythm, and small desktop-only graphics beside the key actions — without touching the Collab data model or the composer's logic.

## What changes

**1. Hero (rewritten, still one screen)**
- Kicker line above the headline: "Workshop — where people find collaborators."
- Headline stays "Find the people to make it with."
- Sub-paragraph explains the product in plain terms: a Collab is a public page for one project; anyone can see it and apply, no account needed to respond.
- Three short proof chips under the buttons: "Free to post", "Public link", "No account needed to apply".
- Desktop only: a small line-art mark sits to the right of the button row (an abstract "call-and-response" glyph). Hidden on mobile, decorative, `aria-hidden`.

**2. "What is a Collab?" — new section**
Short editorial block, two columns on desktop, that answers the three things the user named:
- **Open feedback** — anyone with the link can read the Collab and respond, including people with no Workshop account.
- **Structured roles** — say exactly who you need (director, bassist, editor) instead of a vague post; applicants apply to a specific role.
- **Track the production** — the Collab page stays live as the project's home: applications, collaborators, and updates in one place.

Each item gets a small monochrome line icon on desktop (24px, muted), text-only on mobile.

**3. How it works** — kept, but tightened
Same three steps, with the number rendered as a large muted numeral and a hairline rule, so it reads editorial rather than as three generic cards.

**4. Examples section** — kept
Adds a one-line subhead ("Real Collabs, open right now.") and a "Browse all Collabs" link for signed-out browsing.

**5. Composer section**
- Adds a lead-in line above the form: "Takes about a minute. You only need a free account when you publish."
- Fixes the stray floating status line seen in the screenshot: when the composer is embedded with the heading hidden, the readiness dot/line moves inside the form card instead of hanging in whitespace above it.

**6. Closing strip**
Replaces the bare footer line with a final call to action: one sentence, a "Start a Collab" button that scrolls back to the form, and the existing Workshop mark + copyright.

## Technical notes

- All edits in `src/routes/start-a-collab.tsx`, plus one small conditional in `src/routes/collab.new.tsx` for the readiness line placement when `hideHeading` is set. No change to composer fields, validation, draft persistence, or `useCollabDraftFlow`.
- Mini graphics are inline SVG in the route file using `currentColor` and semantic tokens — no image assets, no new dependencies, no layout shift. Rendered `hidden md:block`.
- Existing analytics events are preserved; the new closing CTA fires the same `start_a_collab_clicked` event.
- Head metadata unchanged.
