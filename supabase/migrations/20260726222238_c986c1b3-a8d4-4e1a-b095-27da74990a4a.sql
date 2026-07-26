-- Public profile reads should never expose exact birthdate or home city to
-- anonymous visitors. RLS still allows SELECT (true), but column-level
-- privileges from `anon` are revoked so PostgREST rejects those columns.
REVOKE SELECT (birthdate, home_city_id) ON public.profiles FROM anon;