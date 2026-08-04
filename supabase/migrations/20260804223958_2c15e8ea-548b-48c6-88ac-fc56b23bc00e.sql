CREATE OR REPLACE FUNCTION public.enforce_collabs_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  _active_count bigint;
  _is_active boolean;
  _was_active boolean;
begin
  _is_active := NEW.archived_at is null
    and NEW.resulting_work_id is null
    and coalesce(NEW.applications_open, false) = true
    and NEW.status not in ('draft','removed','archived');

  if TG_OP = 'UPDATE' then
    _was_active := OLD.archived_at is null
      and OLD.resulting_work_id is null
      and coalesce(OLD.applications_open, false) = true
      and OLD.status not in ('draft','removed','archived');
  else
    _was_active := false;
  end if;

  if _is_active and not _was_active then
    if not public.is_user_plus(NEW.user_id) then
      select count(*) into _active_count
      from public.collab_posts
      where user_id = NEW.user_id
        and id is distinct from NEW.id
        and archived_at is null
        and resulting_work_id is null
        and coalesce(applications_open, false) = true
        and status not in ('draft','removed','archived');
      if _active_count >= 2 then
        raise exception 'Free tier collab limit reached';
      end if;
    end if;
  end if;

  return NEW;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_collabs_quota() FROM PUBLIC;