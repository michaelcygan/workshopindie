CREATE OR REPLACE FUNCTION public.subcategory_field(_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _id IS NULL THEN NULL
    WHEN position('.' in _id) = 0 THEN NULL
    ELSE public.canonical_category(split_part(_id, '.', 1))
  END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_entity_subcategories()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _field text;
  _sub text;
BEGIN
  IF NEW.subcategories IS NULL OR array_length(NEW.subcategories, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  IF array_length(NEW.subcategories, 1) > 1 THEN
    RAISE EXCEPTION 'Only one specialization is allowed.';
  END IF;

  _sub := NEW.subcategories[1];
  _field := public.canonical_category(COALESCE(NEW.category_canonical::text, NEW.category::text));

  IF public.subcategory_field(_sub) IS NULL THEN
    RAISE EXCEPTION 'Unknown specialization: %', _sub;
  END IF;

  IF public.subcategory_field(_sub) IS DISTINCT FROM _field THEN
    RAISE EXCEPTION 'That specialization does not belong to the selected field.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_blog_subcategories()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _sub text;
BEGIN
  IF NEW.subcategories IS NULL OR array_length(NEW.subcategories, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  IF array_length(NEW.subcategories, 1) > 1 THEN
    RAISE EXCEPTION 'Only one specialization is allowed.';
  END IF;

  _sub := NEW.subcategories[1];

  IF public.subcategory_field(_sub) IS NULL THEN
    RAISE EXCEPTION 'Unknown specialization: %', _sub;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(NEW.fields, ARRAY[]::text[])) AS f(value)
    WHERE public.canonical_category(f.value) = public.subcategory_field(_sub)
  ) THEN
    RAISE EXCEPTION 'That specialization does not belong to the post''s fields.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_event_subcategory()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _field text;
BEGIN
  IF NEW.subcategory IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.subcategory_field(NEW.subcategory) IS NULL THEN
    RAISE EXCEPTION 'Unknown specialization: %', NEW.subcategory;
  END IF;

  _field := public.canonical_category(NEW.category::text);

  IF public.subcategory_field(NEW.subcategory) IS DISTINCT FROM _field THEN
    RAISE EXCEPTION 'That specialization does not belong to the selected field.';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.validate_profile_specialties()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _sub text;
BEGIN
  IF NEW.specialties IS NULL OR array_length(NEW.specialties, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  IF array_length(NEW.specialties, 1) > 12 THEN
    RAISE EXCEPTION 'At most 12 specialties.';
  END IF;

  FOREACH _sub IN ARRAY NEW.specialties LOOP
    IF public.subcategory_field(_sub) IS NULL THEN
      RAISE EXCEPTION 'Unknown specialty: %', _sub;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM unnest(
        COALESCE(NEW.categories_canonical, ARRAY[]::text[])
        || COALESCE(NEW.categories::text[], ARRAY[]::text[])
      ) AS f(value)
      WHERE public.canonical_category(f.value) = public.subcategory_field(_sub)
    ) THEN
      RAISE EXCEPTION 'Specialty % does not belong to a field on this profile.', _sub;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS validate_subcategories ON public.works;
CREATE TRIGGER validate_subcategories
BEFORE INSERT OR UPDATE ON public.works
FOR EACH ROW EXECUTE FUNCTION public.validate_entity_subcategories();

DROP TRIGGER IF EXISTS validate_subcategories ON public.collab_posts;
CREATE TRIGGER validate_subcategories
BEFORE INSERT OR UPDATE ON public.collab_posts
FOR EACH ROW EXECUTE FUNCTION public.validate_entity_subcategories();

DROP TRIGGER IF EXISTS validate_subcategories ON public.workshops;
CREATE TRIGGER validate_subcategories
BEFORE INSERT OR UPDATE ON public.workshops
FOR EACH ROW EXECUTE FUNCTION public.validate_entity_subcategories();

DROP TRIGGER IF EXISTS validate_subcategories ON public.blog_posts;
CREATE TRIGGER validate_subcategories
BEFORE INSERT OR UPDATE ON public.blog_posts
FOR EACH ROW EXECUTE FUNCTION public.validate_blog_subcategories();

DROP TRIGGER IF EXISTS validate_subcategory ON public.group_events;
CREATE TRIGGER validate_subcategory
BEFORE INSERT OR UPDATE ON public.group_events
FOR EACH ROW EXECUTE FUNCTION public.validate_event_subcategory();

DROP TRIGGER IF EXISTS validate_specialties ON public.profiles;
CREATE TRIGGER validate_specialties
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.validate_profile_specialties();

REVOKE EXECUTE ON FUNCTION public.validate_entity_subcategories() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_blog_subcategories() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_event_subcategory() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_profile_specialties() FROM PUBLIC, anon, authenticated;