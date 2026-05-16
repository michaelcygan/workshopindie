
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS instagram_handle text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_instagram_handle_chk
  CHECK (instagram_handle IS NULL OR instagram_handle ~ '^[a-z0-9_.]{1,30}$');

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _first text := NULLIF(NEW.raw_user_meta_data->>'first_name', '');
  _last  text := NULLIF(NEW.raw_user_meta_data->>'last_name', '');
  _ig    text := NULLIF(lower(NEW.raw_user_meta_data->>'instagram_handle'), '');
  _display text := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'display_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(trim(concat_ws(' ', _first, _last)), ''),
    split_part(NEW.email,'@',1)
  );
BEGIN
  IF _ig IS NOT NULL THEN
    _ig := regexp_replace(_ig, '^@', '');
    IF _ig !~ '^[a-z0-9_.]{1,30}$' THEN
      _ig := NULL;
    END IF;
  END IF;

  INSERT INTO public.profiles (id, display_name, avatar_url, first_name, last_name, instagram_handle)
  VALUES (
    NEW.id,
    _display,
    NEW.raw_user_meta_data->>'avatar_url',
    _first,
    _last,
    _ig
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;
