
-- Fix mutable search_path on slugify
create or replace function public.slugify(_in text)
returns text language sql immutable set search_path = public as $$
  select trim(both '-' from regexp_replace(lower(coalesce(_in,'')), '[^a-z0-9]+', '-', 'g'))
$$;

-- Drop broad SELECT policies on storage.objects for our public buckets.
-- Public buckets are still readable via the CDN public URL; we just don't need to allow listing.
drop policy if exists "public read avatars" on storage.objects;
drop policy if exists "public read covers" on storage.objects;
drop policy if exists "public read work-covers" on storage.objects;
