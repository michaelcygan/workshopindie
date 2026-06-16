# Groups v1 — Launch Plan

Replace `cities` as the user-facing organizer with **Groups**: a unified container that holds Workshops, Collabs, Works, and Members. Cities become *one kind* of group. Admin-curated at launch; one-tap join; public membership with per-user opt-out.

## Why this is the right move

- Rural / suburban liquidity: a solo filmmaker in Asheville has no scene, but can join "Southern Gothic Shorts" and find their people.
- Dense cities still work: "Chicago" is a city-group **plus** nested "Chicago footwork", "Pilsen visual", etc.
- One primitive, many shapes (geo, genre, micro-genre × city, scene, UGC niche) — no second taxonomy to maintain.
- Admin curation at launch = quality bar, hand-seeded membership, no spam — you set the tone before opening UGC creation later.

---

## 1. Data model — one table, one migration

**`groups`** (the new primitive, replaces `cities` as the public-facing org unit)

| field | purpose |
|---|---|
| `id`, `slug` (unique), `name`, `tagline`, `description` | identity |
| `kind` (`city` \| `genre` \| `micro` \| `scene`) | shape of the group |
| `city_id` (nullable FK → cities) | for `city` groups + "Chicago footwork" style micros |
| `cover_url`, `avatar_url`, `accent_color` | visual identity |
| `join_mode` (`open` \| `gated`) | v1 ships everything `open`; column ready for later |
| `visibility` (`public` \| `unlisted`) | unlisted = direct-link only |
| `member_count`, `workshop_count`, `collab_count`, `work_count` | denormalized counters |
| `created_by` (admin user), `is_official` (bool), `featured_at` | admin-curated surface |

**Cities → groups migration:** every existing `cities` row mirrors into `groups` with `kind='city'`, `city_id=self`. **Keep `cities`** as the geo/IP/home-city source of truth (geo lookup, "city changed once per 30 days", IP-nearest). `groups` becomes the org/social layer. Old `city_id` FKs on `collab_posts`, `works`, `workshops`, `profiles.home_city_id` stay intact.

**`group_members`** — `(group_id, user_id, role, joined_at)`. Role: `member` \| `steward` \| `owner` (only `member` used in v1, others reserved).

**`group_workshops` / `group_collabs` / `group_works`** — many-to-many tag tables so a single post can belong to multiple groups (e.g. a Collab posted in "Chicago" + "Indie Horror"). Triggers maintain counters on `groups`.

**`profiles.hide_group_memberships`** (bool, default false) — the privacy opt-out.

**Realtime:** add `group_members`, `group_workshops`, `group_collabs`, `group_works` to the publication so group pages live-update.

**Counters & triggers:** mirror the existing pattern (`tg_collab_vouches_counter`-style) — increment/decrement on tag-table insert/delete.

---

## 2. Routes

| Route | Purpose |
|---|---|
| `/groups` | Browse all groups. Tabs: **For you** (joined + nearby city), **Cities**, **Genres**, **Micro**, **Scenes**. Search + featured rail. |
| `/g/$slug` | Group home: hero (cover, name, member count, Join button), tabs → **Workshops** / **Collabs** / **Work** / **Members** / **About**. |
| `/g/$slug/workshops` | Workshops scoped to this group. "Create Workshop in {group}" CTA → existing `/workshops/new` with `group_id` prefilled. Supports in-person, online, **external link** (Zoom/Discord — we list, don't host). |
| `/g/$slug/collab` | Collab board scoped to group, "Post Collab in {group}" CTA. |
| `/g/$slug/gallery` | Work gallery scoped, with Boosted + Fresh rails inherited. |
| `/g/$slug/members` | Member directory (avatars, recent shipped work). Hidden members not listed; count still accurate. |
| `/admin/groups` | Admin CRUD: create/edit/delete groups, mark featured, seed members, set cover/avatar. |

`/cities/*` routes stay as redirects → `/g/{city-slug}` for backwards compatibility.

---

## 3. Feeds — joined-first, city-fallback

`/gallery`, `/collab`, `/workshops`:
1. **Signed in + has joined groups**: feed = union of items tagged to joined groups, ranked by recency + boost/vouch signals. Header: "Your groups" with a chip per group.
2. **Signed in, no groups joined**: fall back to IP/home-city (current behavior), with a soft banner: "Join a Group to make this yours →".
3. **Logged out**: worldwide-first (current), with `/groups` featured in the logged-out hero.

City/Online filters remain as orthogonal chips. "Worldwide" stays available.

---

## 4. Workshop / Collab / Work creation — group picker

Add a multi-select **Groups** picker to:
- `/workshops/new` (and `/workshops/lobby/new`)
- `/collab/new`
- `/works/new` (and `/works/collab/new`)

Defaults: pre-selects the user's joined groups that match (city group always pre-selected if location matches). Max 3 groups per post (prevents spam-tagging).

External-link Workshops: existing `workshops` already supports external/online — surface an `external_url` field if missing, and gate the "Enter Workshop" button to open the external link in a new tab when set.

---

## 5. Admin tooling (`/admin/groups`)

- Table of all groups with quick edit (name, kind, cover, featured).
- "Create Group" form (name, slug, kind, optional city_id, tagline, description, cover upload, accent color).
- "Seed members" — paste handles / search users, bulk add to `group_members`.
- Feature toggle (`featured_at`) for the `/groups` top rail.
- Soft-delete (`deleted_at`) — preserves history.

Admin gate: existing `has_role(auth.uid(), 'admin')`.

---

## 6. Surfaces touched (UI polish, same level as Workshop/Collab/Work)

- **Top nav**: add "Groups" link between "Work" and "Workshops".
- **Mobile nav**: same.
- **Profile (`/u/$username`)**: new "Groups" strip showing joined groups (respects `hide_group_memberships`).
- **Onboarding**: new step — "Pick 3 groups to follow" with featured + city-nearest suggestions. Single biggest activation lever.
- **Collab card / Work card / Workshop card**: add small group chip(s) under the title.
- **Notifications**: new kind `group_added` (admin seeded you into a group) + `group_workshop_live` (Workshop in your group just went live).

---

## 7. What ships, what waits

**v1 (this build):**
- Groups schema + cities mirror
- `/groups`, `/g/$slug` + 4 sub-tabs
- Admin CRUD + seeding
- Group picker on Workshop/Collab/Work creation
- Joined-first feeds with city fallback
- Onboarding "pick 3 groups" step
- Profile group strip + privacy opt-out
- Realtime on group tables

**v1.1 (next, not now):**
- "Suggest a Group" user queue
- Stewards / per-group moderation
- Group lounges (live presence per group)
- Group pinned resources / drive folder / recurring meetup info
- Gated `join_mode='gated'` flow
- Group-scoped notifications digest

---

## Open question for you

**Migration of existing posts**: should I auto-tag every existing Collab/Work/Workshop into its `city_id`'s mirror city-group, so day-one Chicago group isn't empty? (My recommendation: yes, one-time backfill in the same migration.)

```text
cities ──mirror──► groups (kind='city')
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
    group_workshops  group_collabs  group_works   (many-to-many tags)
          │          │          │
          └──────────┴──────────┘
                     │
                feeds: union of joined groups, ranked
```
