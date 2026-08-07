CREATE OR REPLACE FUNCTION public.enforce_username_namespace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reserved text[] := ARRAY[
    'admin','api','auth','blog','checkout','cities','claim','collab','dms','e','events',
    'forgot-password','g','gallery','goodbye','groups','index','login','lounge','mcp','me',
    'onboarding','pricing','redeem','refer','reset-password','settings','signup','sitemap',
    'sitemap.xml','u','w','works','workshops',
    'about','account','careers','contact','discover','explore','feed','help','home','legal',
    'messages','notifications','press','privacy','profile','search','security','shop','static',
    'store','support','terms','workshop','workshopindie','robots.txt','favicon.ico','llms.txt'
  ];
BEGIN
  IF NEW.username IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.username := lower(NEW.username);

  IF NEW.username !~ '^[a-z0-9_-]{2,30}$' THEN
    RAISE EXCEPTION 'Usernames must be 2-30 characters using lowercase letters, numbers, hyphens or underscores.'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.username = ANY (reserved) THEN
    RAISE EXCEPTION 'That username is reserved by Workshop.'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_username_namespace_trg ON public.profiles;
CREATE TRIGGER enforce_username_namespace_trg
BEFORE INSERT OR UPDATE OF username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_username_namespace();

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;