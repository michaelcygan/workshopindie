-- 1. Lounge monthly minute counter
create or replace function public.lounge_minutes_this_month(_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(count(*), 0)::int
  from public.lounge_audio_events
  where user_id = _user_id
    and event = 'connected_minutes'
    and created_at >= date_trunc('month', (now() at time zone 'utc'));
$$;

grant execute on function public.lounge_minutes_this_month(uuid) to authenticated;

-- 2. Reserve one minute atomically; returns true when the row was inserted.
create or replace function public.try_reserve_lounge_minute(
  _user_id uuid,
  _room_id uuid,
  _limit integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  used int;
begin
  if _user_id is null then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtext('lounge_minute:' || _user_id::text));

  if _limit is not null then
    select coalesce(count(*), 0) into used
    from public.lounge_audio_events
    where user_id = _user_id
      and event = 'connected_minutes'
      and created_at >= date_trunc('month', (now() at time zone 'utc'));

    if used >= _limit then
      return false;
    end if;
  end if;

  insert into public.lounge_audio_events (user_id, room_id, event, payload)
  values (_user_id, _room_id, 'connected_minutes', '{}'::jsonb);

  return true;
end;
$$;

grant execute on function public.try_reserve_lounge_minute(uuid, uuid, integer) to authenticated;

-- 3. Fix work_applications privilege escalation
drop policy if exists "self updates own application" on public.work_applications;

create policy "self updates own application"
on public.work_applications
for update
to authenticated
using (applicant_user_id = auth.uid())
with check (applicant_user_id = auth.uid());

create or replace function public.work_applications_guard_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Work owners bypass all restrictions.
  if public.is_work_owner(new.work_id, auth.uid()) then
    return new;
  end if;

  -- Non-owners cannot change status, work_id, or applicant_user_id.
  if new.status is distinct from old.status then
    raise exception 'Only the work owner can change application status';
  end if;
  if new.work_id is distinct from old.work_id then
    raise exception 'Cannot change work_id on an application';
  end if;
  if new.applicant_user_id is distinct from old.applicant_user_id then
    raise exception 'Cannot change applicant_user_id on an application';
  end if;

  return new;
end;
$$;

drop trigger if exists work_applications_guard_status on public.work_applications;
create trigger work_applications_guard_status
before update on public.work_applications
for each row execute function public.work_applications_guard_status();