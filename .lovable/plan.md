## Goal

Turn the single shared Recorder into a per-user multi-tab studio. Each user gets their own recorder state. A user can spin up named "Personas" (tabs) inside Capture a take, invite other users in the room into a persona, and trigger a synchronized take across everyone in that persona. Tracks land in both the persona owner's take folder and each contributor's own take folder.

## How it works (end-user)

```text
┌─ Recorder ─────────────────────────────────────────────┐
│ [● Solo]  [● Producer A]  [● Drums chain]  [ + Persona]│  ← tabs (personas)
├────────────────────────────────────────────────────────┤
│ PERSONA · Producer A                  Members: 3       │
│ Owned by you · 2 invited · Privacy: Workshop only      │
│                                                        │
│  Invite from room ▾    Recording control: Owner-start  │
│                                                        │
│  SOURCES (your machine)                                │
│   ☐ My room camera · LIVE                              │
│   ☑ Logic Pro Out (line-in) · ▮▮▮▮▯                    │
│   ☐ Screen                                             │
│                                                        │
│  COLLABORATORS · their picked sources show here        │
│   ▸ Sarah  · Mic, Cam        status: Ready             │
│   ▸ Theo   · Bass DI         status: Recording 00:42   │
│                                                        │
│  LAYOUT  [Grid] [Spotlight] [Single]                   │
│                                                        │
│  [● Record take]            00:42 · 3 streams live     │
└────────────────────────────────────────────────────────┘
```

- "Solo" tab always exists — a private persona only you see (current behaviour).
- Any user can create a new persona, name it, and invite room members. Invitees see it appear as a new tab inside their own Recorder with an "Accept" banner. They pick their own local sources, hit "Ready". The owner (or any member, depending on control mode) hits Record — a synchronized start broadcast fires; each browser records its own enabled sources locally, then on stop everyone uploads under the same `take_id` to both their own drive and the owner's drive.

## Recording control

- Default: each member starts/stops their own take, but the persona owner has a "Start everyone" button that pops a confirm dialog on each member's screen ("Producer A is starting a take — Join / Skip this one"). Accept → that member's local recorder starts in sync; Skip → only owner's sources record.
- Stop: each member can stop themselves any time; the owner's stop ends the mixed take and finalizes upload grouping.

## Upload destination

- Each recorded source uploads to both:
  - The recording user's own drive (their take_id, owner_user_id = self).
  - The persona owner's drive (linked_take_id = owner take_id, contributor_user_id = self).
- In persistent (workshop) rooms, the persona's "Privacy" toggle gates the duplication: Workshop-only (default, mirrors to owner) vs Private (each user keeps their own; no mirror).
- Mixed take is always built locally by the persona owner from streams everyone is currently sending via WebRTC plus the owner's own local sources, and uploads only to the owner's drive.

## Data model

Two new tables (per room scope) plus a column on existing drive tables.

```sql
-- Instant-room personas (ephemeral, per room)
create table public.recorder_personas (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.instant_rooms(id) on delete cascade,
  owner_user_id uuid not null,
  name text not null,
  control_mode text not null default 'owner_start',   -- owner_start | self
  privacy text not null default 'shared',             -- shared | private (workshop scope only)
  created_at timestamptz default now()
);
create table public.recorder_persona_members (
  persona_id uuid references public.recorder_personas(id) on delete cascade,
  user_id uuid not null,
  state text not null default 'invited',              -- invited | ready | recording | declined
  joined_at timestamptz default now(),
  primary key (persona_id, user_id)
);
-- Mirror tables for persistent workshops:
-- workshop_recorder_personas, workshop_recorder_persona_members (same shape, workshop_id fk).
-- Add column on instant_drive_files + workshop_drive_files:
alter table public.instant_drive_files add column linked_persona_id uuid;
alter table public.instant_drive_files add column linked_take_owner_user_id uuid;
-- (same on workshop_drive_files)
```

RLS: members can read their own personas + ones they're invited to. Owner can update/delete. Members can insert their own member row when invited. GRANTs to authenticated + service_role; no anon.

Realtime: persona changes + member state changes broadcast over the existing `recorder:${roomId}` Supabase channel (new event types: `persona.created`, `persona.member.update`, `persona.start`, `persona.stop`).

## UI / files

- `src/components/recorder/personas-tabs.tsx` — horizontal tab strip with "+ Persona" button. Solo + dynamic personas.
- `src/components/recorder/persona-panel.tsx` — refactor of the current `workshop-recorder.tsx` body into a panel that takes a `personaId`; owns local engine, sources, layout, record button. Renders both "Your sources" and "Collaborators".
- `src/components/recorder/persona-invite.tsx` — popover that lists room peers + invite/remove.
- `src/components/recorder/persona-consent-dialog.tsx` — "Start everyone" popup on invitee browsers.
- `src/components/workshop-recorder.tsx` — slimmed to a shell that renders `<PersonasTabs>` + the active `<PersonaPanel>`. Each `PersonaPanel` instance has its own `RecorderEngine`, so per-user/per-persona isolation is automatic.
- `src/lib/recorder-personas.functions.ts` — server fns: `createPersona`, `invitePersonaMember`, `setPersonaMemberState`, `removePersona`, `listPersonas`. All `requireSupabaseAuth`.

## Design (2027-utilitarian)

- Tabs: soft pill row, hairline divider under, mono-ish small caps for persona name, owner avatar inline. Active tab: ink fill, white text. Live recording: 4px live red dot pulses on the tab.
- Persona body keeps the existing serif "Capture a take" title; add a single-line sub-meta: "Owned by Sarah · 3 members · Workshop only". Big record button stays bottom-right; collaborator rows are a thin list with avatar, name, source chips, status. No new color tokens — uses existing surface/ink palette.
- Empty Solo state mirrors today. New "+ Persona" CTA inline in tab strip.

## Out of scope

- Cross-room persona presets (per-room only, as agreed).
- Persona templates saved to profile.
- Editing a track after upload.
- Conflict resolution if two members both have "owner_start" rights (only the owner can fire the synced start; members in `self` mode just record locally).
