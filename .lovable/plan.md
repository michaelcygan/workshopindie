## Problem

Posting an event fails with `relation "public.event_short_codes" does not exist`.

An earlier "search_path hardening" migration (`20260714012327_…`) rewrote `public.gen_event_short_code()` and, in doing so, changed the uniqueness check from `public.group_events` to a nonexistent `public.event_short_codes` table. The BEFORE INSERT trigger `trg_group_events_short_code` calls this function on every event insert, so every admin event creation now throws.

## Fix

Ship a one-statement migration that restores `gen_event_short_code()` to check `public.group_events.short_code` (matching the original 20260619 definition) while keeping the `SET search_path = public` hardening.

```sql
CREATE OR REPLACE FUNCTION public.gen_event_short_code()
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..6 LOOP
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.group_events WHERE short_code = code);
  END LOOP;
  RETURN code;
END;
$function$;
```

No code changes required — this is purely a DB fix.
