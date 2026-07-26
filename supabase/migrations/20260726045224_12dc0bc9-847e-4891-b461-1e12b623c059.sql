create or replace function public.is_user_plus(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions
    where user_id = _user_id
      and tier = 'plus'
      and status in ('active', 'trialing')
      and (current_period_end is null or current_period_end > now())
    order by created_at desc
    limit 1
  );
$$;

create or replace function public.enforce_works_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _published_count bigint;
begin
  if NEW.status = 'published'
     and (TG_OP = 'INSERT' or OLD.status is distinct from 'published')
  then
    if not public.is_user_plus(NEW.created_by) then
      select count(*) into _published_count
      from public.works
      where created_by = NEW.created_by
        and status = 'published'
        and id is distinct from NEW.id;
      if _published_count >= 10 then
        raise exception 'Free tier work limit reached';
      end if;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists works_quota_enforcement on public.works;
create trigger works_quota_enforcement
  before insert or update on public.works
  for each row execute function public.enforce_works_quota();

create or replace function public.enforce_collabs_quota()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _open_count bigint;
begin
  if NEW.status = 'open'
     and (TG_OP = 'INSERT' or OLD.status is distinct from 'open')
  then
    if not public.is_user_plus(NEW.user_id) then
      select count(*) into _open_count
      from public.collab_posts
      where user_id = NEW.user_id
        and status = 'open'
        and id is distinct from NEW.id;
      if _open_count >= 2 then
        raise exception 'Free tier collab limit reached';
      end if;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists collabs_quota_enforcement on public.collab_posts;
create trigger collabs_quota_enforcement
  before insert or update on public.collab_posts
  for each row execute function public.enforce_collabs_quota();