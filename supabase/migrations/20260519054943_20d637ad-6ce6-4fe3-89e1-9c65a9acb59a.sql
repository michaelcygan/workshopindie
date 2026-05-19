-- =====================================================
-- Guest applications (logged-out apply flow)
-- =====================================================
create table public.collab_guest_applications (
  id uuid primary key default gen_random_uuid(),
  collab_post_id uuid not null references public.collab_posts(id) on delete cascade,
  collab_role_id uuid references public.collab_roles(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  message text not null,
  portfolio_url text,
  reel_url text,
  instagram_handle text,
  ip_hash text,
  user_agent text,
  status text not null default 'new', -- new | contacted | spam | hidden
  created_at timestamptz not null default now(),
  contacted_at timestamptz,
  matched_user_id uuid references auth.users(id) on delete set null,
  matched_at timestamptz
);

create index idx_guest_apps_post on public.collab_guest_applications (collab_post_id, created_at desc);
create index idx_guest_apps_email on public.collab_guest_applications (lower(email));
create index idx_guest_apps_ip_recent on public.collab_guest_applications (ip_hash, created_at desc);

alter table public.collab_guest_applications enable row level security;

-- Owner reads guest apps on their posts
create policy "owner reads guest apps"
  on public.collab_guest_applications for select to authenticated
  using (exists (
    select 1 from public.collab_posts p
    where p.id = collab_guest_applications.collab_post_id
      and p.user_id = auth.uid()
  ));

-- Owner updates status (mark contacted / spam / hidden)
create policy "owner updates guest app"
  on public.collab_guest_applications for update to authenticated
  using (exists (
    select 1 from public.collab_posts p
    where p.id = collab_guest_applications.collab_post_id
      and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.collab_posts p
    where p.id = collab_guest_applications.collab_post_id
      and p.user_id = auth.uid()
  ));

-- Admins manage
create policy "admins manage guest apps"
  on public.collab_guest_applications for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Note: no INSERT policy. Inserts must go through the server function
-- using the service-role key (which bypasses RLS). This stops random
-- anon clients from inserting directly via the JS SDK.

-- =====================================================
-- Share tracking
-- =====================================================
create table public.collab_share_events (
  id uuid primary key default gen_random_uuid(),
  collab_post_id uuid not null references public.collab_posts(id) on delete cascade,
  channel text not null check (channel in ('copy','native','story_image','caption','other')),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idx_share_events_post on public.collab_share_events (collab_post_id, created_at desc);

alter table public.collab_share_events enable row level security;

create policy "anyone logs a share"
  on public.collab_share_events for insert to anon, authenticated
  with check (true);

create policy "owner reads shares"
  on public.collab_share_events for select to authenticated
  using (exists (
    select 1 from public.collab_posts p
    where p.id = collab_share_events.collab_post_id
      and p.user_id = auth.uid()
  ));

create policy "admins manage shares"
  on public.collab_share_events for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- =====================================================
-- Backfill guest applications when an email signs up
-- =====================================================
create or replace function public.backfill_guest_applications_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _email text := lower(coalesce(new.email, ''));
begin
  if _email = '' then
    return new;
  end if;

  -- Link unmatched guest apps with this email to the new user
  update public.collab_guest_applications
     set matched_user_id = new.id,
         matched_at = now()
   where matched_user_id is null
     and lower(email) = _email;

  -- Mirror them into the native contact-events feed so the post owner
  -- sees one unified inbox.
  insert into public.collab_contact_events (collab_post_id, collab_role_id, sender_user_id, message_preview)
  select g.collab_post_id, g.collab_role_id, new.id, left(g.message, 280)
    from public.collab_guest_applications g
   where g.matched_user_id = new.id;

  return new;
end;
$$;

create trigger trg_backfill_guest_apps_on_signup
after insert on auth.users
for each row execute function public.backfill_guest_applications_on_signup();