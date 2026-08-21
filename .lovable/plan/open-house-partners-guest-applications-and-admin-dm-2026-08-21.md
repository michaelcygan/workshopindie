# Open House: partners, guest applications, and admin DM

Three changes to the Open House funnel at `/applyopenhouse` and the admin review panel.

## 1. Partner categories (vendors, brands, listening parties)

Replace the current single "What would you like to do?" list with a broader partner taxonomy. Proposed list:

- **Host** — MC or run the room
- **Performance** — opens a sub-type popout (below)
- **Listening party** — album or project playback
- **Screening** — film, video, or work-in-progress
- **Talk or reading** — lecture, panel, poetry, prose
- **Workshop or demonstration** — teach or show a process
- **Art or craft vendor** — table, prints, goods
- **Food vendor** — food, drink, catering partner
- **Brand or sponsor** — product, activation, support
- **Something else**

When **Performance** is chosen, a second field appears asking "What kind?": DJ, Band, Solo musician, Comedian, Dancer, Poet or spoken word, Theater or improv, Something else — with a short free-text box when "Something else" is picked.

Vendor and brand selections adjust the rest of the form's language: "Approximate length" is hidden for vendors/brands and replaced by a "Space and power needs" prompt; the proposal label becomes "What would you bring to Open House?" so it reads naturally for a food truck or a brand as well as a band.

Existing applications keep working: current values map to the new list (live music / DJ set / performance → Performance with the matching sub-type; talk → Talk or reading; reading → Talk or reading; screening → Screening; demonstration → Workshop or demonstration; other → Something else). Admin filters gain a category chip row so vendors, brands, and talent can be reviewed separately.

## 2. Logged-out applications and account creation

Logged-out visitors can already apply — that stays. The account checkbox gets real framing:

> **Create a Workshop account with this application** (recommended)
> Applicants with an account are far more likely to be booked. Booking happens on Workshop — scheduling, details, and messages with the Open House team all stay in one place.

Below the submit button, the "No account needed" line is kept but softened to: "No account required — but having one gets you booked faster." After submitting with the box checked, the applicant continues to `/signup` prefilled (unchanged behavior). If they later sign up with the same email, the application links to their account automatically.

## 3. Admin DM from the application panel

In the application detail sheet, add a **Message applicant** action:

- If the application is linked to a Workshop account, the admin opens (or reuses) a DM thread with that person, pre-seeded with the application context, and lands in `/dms/<id>`.
- If there is no linked account, the button is disabled with "No account yet — they'll be reachable here once they sign up," alongside the existing copy-email control.

The DM thread shows a context chip at the top: **From application to: Workshop Open House** with the applicant's proposal title, linking back to the admin record for admins.

## Technical notes

**Database**
- `open_house_applications`: add `partner_type` (text, checked against the new list), `performance_subtype` (text, nullable), `performance_subtype_other` (text, nullable). Backfill `partner_type` from `program_type` per the mapping above; keep `program_type` populated for now so nothing breaks, and treat `partner_type` as canonical in new code.
- `conversations`: add `context_open_house_application_id uuid references open_house_applications(id) on delete set null` + index; extend `get_or_create_conversation` with the new parameter.
- `can_dm(_a,_b)`: add an `OR public.has_role(_a,'admin') OR public.has_role(_b,'admin')` branch so admin accounts can open a thread with any member (blocks and `dm_policy='nobody'` still apply first).

**Code**
- `src/lib/open-house.ts` — new `PARTNER_TYPES` and `PERFORMANCE_SUBTYPES` constants, labels, and helpers; keep the legacy maps for old rows.
- `src/routes/applyopenhouse.tsx` — new category select, conditional sub-type field, vendor-aware labels, new checkbox copy.
- `src/lib/open-house-applications.functions.ts` — validate and persist the new fields; moderation on the free-text sub-type.
- `src/lib/dms.functions.ts` + `src/routes/dms.$conversationId.tsx` / `dms.index.tsx` — carry and render the Open House context.
- `src/routes/admin.open-house.tsx` — category filters, sub-type display, and the Message applicant action.
