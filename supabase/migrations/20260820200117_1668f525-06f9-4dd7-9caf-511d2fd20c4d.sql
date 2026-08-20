create or replace function public.tg_collab_autoslug()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare base text; candidate text; n int := 0;
begin
  if new.slug is null or length(new.slug) = 0 then
    base := nullif(public.slugify(new.title), '');
    if base is null then base := 'collab'; end if;
    if base in ('new','remote') then base := base || '-collab'; end if;
    candidate := base;
    while exists(select 1 from public.collab_posts where slug = candidate) loop
      n := n + 1; candidate := base || '-' || n;
    end loop;
    new.slug := candidate;
  end if;
  return new;
end $$;