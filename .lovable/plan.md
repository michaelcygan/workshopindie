# /start-a-collab — acquisition landing page for Collabs

A standalone public page that explains Collabs, shows a few real ones, and lets anyone fill out the existing Collab form before being asked to create an account. Reachable only by direct URL — nothing in the site navigation links to it.

## What gets built

**1. The page (`/start-a-collab`)**

Sections, top to bottom:
- Minimal header: Workshop mark + wordmark, and "Sign in" for logged-out visitors. No site nav.
- Hero: "Find the people to make it with." with the supplied paragraph, a primary "Start a Collab" button that smooth-scrolls to the form, a "See open Collabs" text link that scrolls to the examples, and the note "Applicants do not need a Workshop account to respond."
- How it works: three compact editorial cards (Describe / Share / Receive), existing card styling, no illustrations.
- "See what people are making": 3–4 real, currently-recruiting public Collabs rendered with the existing Collab card. Tapping a card opens the existing Collab preview dialog (title, creator, description, roles sought, field, location, deadline, "View full Collab" → the real Collab page). The whole section is hidden when nothing eligible comes back.
- "Start your Collab": the existing Collab composer, embedded.
- A short editorial footer strip for this page only (no site footer).

**2. The embedded form is the real form**

The existing composer is reused as-is — same fields, taxonomy pickers, validation, Plus limits, and the same insert into the existing Collab table. No new fields, no second model, no schema change.

For logged-out visitors the final button reads "Continue to publish" with the helper line "Draft your Collab first. A free Workshop account is required to publish it and manage responses." Signed-in members see the normal publish behaviour and publish immediately.

**3. Draft survives account creation**

When a logged-out visitor clicks "Continue to publish":
1. The form validates first; errors block the flow.
2. The complete draft (every field, not just title/description) is saved to the browser tab's storage.
3. The existing account-creation flow opens with the heading "Create your account to publish this Collab." Email and Google both work, and both come back through the existing auth callback and any required onboarding.
4. Once the account is fully ready, the visitor lands back on `/start-a-collab`, the draft is restored, and the Collab is published automatically using the existing creation logic.
5. They are sent to their new public Collab page with the existing share/copy-link state showing.

If auth is cancelled or fails, the draft stays put and they can retry. If they turn out to already have an account and sign in instead, the same draft is restored and published. A one-time submission token stored with the draft ensures a refresh or a double redirect cannot publish twice — once a Collab is created the draft is cleared immediately.

Nothing publishes before the account exists; age verification, moderation, and onboarding all still apply.

**4. Measurement**

Existing analytics only (no new vendor, no pixel). Events fired through the current GA helper: page viewed, "Start a Collab" clicked, preview opened, form started, "Continue to publish" clicked, auth started, auth completed, Collab published. Incoming UTM parameters are captured on arrival and carried through the auth round trip alongside the draft.

Metadata: title "Post a Collab | Workshop", the supplied description, plus og/twitter tags using the existing sharing-image system.

## Technical notes

- New route `src/routes/start-a-collab.tsx`, public, SSR on. Real Collabs are loaded with the existing `recruitingCollabs` filter and `COLLAB_CARD_SELECT`, so the eligibility rules stay in one place.
- Global chrome (`TopNav`, `MobileBrandHeader`, `MobileNav`, `SiteFooter`) is suppressed for this pathname. The footer already has a hide list; a small shared list of chrome-free prefixes will be added so all four agree. That's the only edit outside Collab code.
- `CollabComposer` (in `src/routes/collab.new.tsx`) gains optional props: a full-draft serializer/restorer, `requireAuthBeforePublish` (renders the "Continue to publish" button + helper copy and calls back instead of inserting), and a resume hook. Its existing behaviour on `/collab/new`, in the Lounge dialog, and in the group "Post a Collab" sheet is unchanged. Its current partial `useFormDraftStash` usage is replaced on this path by a complete draft snapshot in a new `src/lib/collab-draft.ts`.
- Resume uses the existing post-auth intent system (`return_to` → `/start-a-collab?resume=1`) so it runs only after the account lifecycle reports ready, matching every other post-auth action.
- Previews reuse `src/components/collab-peek.tsx` (already a Dialog: Escape, click-outside, focus trap, close button).
- No migration. No change to `/collab`, existing Collab URLs, applications, permissions, or taxonomy.
