alter table public.event_series
  add column if not exists extra_group_ids uuid[] not null default '{}',
  add column if not exists last_materialized_at timestamptz,
  add column if not exists last_error text;

alter table public.group_events
  add column if not exists needs_review boolean not null default false;

create or replace function public.ensure_primary_event_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.group_id is not null then
    insert into public.event_groups (event_id, group_id)
    values (new.id, new.group_id)
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.ensure_primary_event_group() from public;
revoke all on function public.ensure_primary_event_group() from anon;
revoke all on function public.ensure_primary_event_group() from authenticated;

drop trigger if exists trg_ensure_primary_event_group on public.group_events;
create trigger trg_ensure_primary_event_group
after insert or update of group_id on public.group_events
for each row execute function public.ensure_primary_event_group();

insert into public.event_groups (event_id, group_id)
select e.id, e.group_id
from public.group_events e
where e.group_id is not null
on conflict do nothing;

update public.group_events e
set venue_city_id = g.city_id
from public.groups g
where e.group_id = g.id
  and g.kind = 'city'
  and g.city_id is not null
  and e.venue_city_id is null
  and e.format in ('in_person', 'hybrid')
  and e.deleted_at is null;

update public.group_events e
set needs_review = true
where e.deleted_at is null
  and e.format in ('in_person', 'hybrid')
  and e.venue_city_id is null;

create index if not exists idx_group_events_discovery
  on public.group_events (visibility, status, ends_at);

create index if not exists idx_group_events_series_starts
  on public.group_events (series_key, starts_at);