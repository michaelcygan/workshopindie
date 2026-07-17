
CREATE OR REPLACE FUNCTION public.ensure_home_city_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_city  RECORD;
  v_group_id UUID;
BEGIN
  IF NEW.home_city_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT id, name, slug INTO v_city FROM public.cities WHERE id = NEW.home_city_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.groups (slug, name, kind, city_id, join_mode, visibility, is_official, created_by, category)
  VALUES (v_city.slug, v_city.name, 'city', v_city.id, 'open', 'public', true, NEW.id, 'city')
  ON CONFLICT (slug) DO NOTHING;

  SELECT id INTO v_group_id FROM public.groups WHERE slug = v_city.slug;

  IF v_group_id IS NOT NULL THEN
    INSERT INTO public.group_members (group_id, user_id, role)
    VALUES (v_group_id, NEW.id, 'member')
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_ensure_home_city_group ON public.profiles;
CREATE TRIGGER profiles_ensure_home_city_group
AFTER INSERT OR UPDATE OF home_city_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.ensure_home_city_group();

-- Backfill memberships for existing profiles with a home city
INSERT INTO public.group_members (group_id, user_id, role)
SELECT g.id, p.id, 'member'
FROM public.profiles p
JOIN public.cities c ON c.id = p.home_city_id
JOIN public.groups g ON g.city_id = c.id AND g.kind = 'city'
WHERE p.home_city_id IS NOT NULL
ON CONFLICT (group_id, user_id) DO NOTHING;
