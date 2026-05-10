
-- Storage buckets (public read, owner write under userId/* path)
insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('covers', 'covers', true),
  ('work-covers', 'work-covers', true)
on conflict (id) do nothing;

-- Public read for these three buckets
create policy "public read avatars"  on storage.objects for select using (bucket_id = 'avatars');
create policy "public read covers"   on storage.objects for select using (bucket_id = 'covers');
create policy "public read work-covers" on storage.objects for select using (bucket_id = 'work-covers');

-- Authenticated users may write into a folder named after their auth uid
create policy "user uploads own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "user updates own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "user deletes own avatar"
  on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "user uploads own cover"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'covers' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "user updates own cover"
  on storage.objects for update to authenticated
  using (bucket_id = 'covers' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "user deletes own cover"
  on storage.objects for delete to authenticated
  using (bucket_id = 'covers' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "user uploads own work cover"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'work-covers' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "user updates own work cover"
  on storage.objects for update to authenticated
  using (bucket_id = 'work-covers' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "user deletes own work cover"
  on storage.objects for delete to authenticated
  using (bucket_id = 'work-covers' and auth.uid()::text = (storage.foldername(name))[1]);

-- Auto stamp published_at when a Work is published
create or replace function public.tg_works_publish_stamp()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'published' and (old.status is distinct from new.status) and new.published_at is null then
    new.published_at = now();
  end if;
  if tg_op = 'INSERT' and new.status = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end $$;

drop trigger if exists works_publish_stamp on public.works;
create trigger works_publish_stamp before insert or update on public.works
for each row execute function public.tg_works_publish_stamp();

-- Slug helper: slugify + ensure uniqueness within a table
create or replace function public.slugify(_in text)
returns text language sql immutable as $$
  select trim(both '-' from regexp_replace(lower(coalesce(_in,'')), '[^a-z0-9]+', '-', 'g'))
$$;

create or replace function public.tg_works_autoslug()
returns trigger language plpgsql set search_path = public as $$
declare base text; candidate text; n int := 0;
begin
  if new.slug is null or length(new.slug) = 0 then
    base := nullif(public.slugify(new.title), '');
    if base is null then base := 'work'; end if;
    candidate := base;
    while exists(select 1 from public.works where slug = candidate) loop
      n := n + 1; candidate := base || '-' || n;
    end loop;
    new.slug := candidate;
  end if;
  return new;
end $$;
drop trigger if exists works_autoslug on public.works;
create trigger works_autoslug before insert on public.works
for each row execute function public.tg_works_autoslug();

create or replace function public.tg_workshops_autoslug()
returns trigger language plpgsql set search_path = public as $$
declare base text; candidate text; n int := 0;
begin
  if new.slug is null or length(new.slug) = 0 then
    base := nullif(public.slugify(new.title), '');
    if base is null then base := 'workshop'; end if;
    candidate := base;
    while exists(select 1 from public.workshops where slug = candidate) loop
      n := n + 1; candidate := base || '-' || n;
    end loop;
    new.slug := candidate;
  end if;
  return new;
end $$;
drop trigger if exists workshops_autoslug on public.workshops;
create trigger workshops_autoslug before insert on public.workshops
for each row execute function public.tg_workshops_autoslug();

create or replace function public.tg_collab_autoslug()
returns trigger language plpgsql set search_path = public as $$
declare base text; candidate text; n int := 0;
begin
  if new.slug is null or length(new.slug) = 0 then
    base := nullif(public.slugify(new.title), '');
    if base is null then base := 'collab'; end if;
    candidate := base;
    while exists(select 1 from public.collab_posts where slug = candidate) loop
      n := n + 1; candidate := base || '-' || n;
    end loop;
    new.slug := candidate;
  end if;
  return new;
end $$;
drop trigger if exists collab_autoslug on public.collab_posts;
create trigger collab_autoslug before insert on public.collab_posts
for each row execute function public.tg_collab_autoslug();
