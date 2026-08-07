WITH doomed AS (
  SELECT c.id AS city_id, c.official_group_id AS group_id
  FROM public.cities c
  WHERE c.slug IN ('champaign','peoria','duluth','green-bay','lansing','dayton','cedar-rapids','springfield','fargo','sioux-falls','louisville','pittsburgh','lexington')
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.home_city_id = c.id)
    AND NOT EXISTS (SELECT 1 FROM public.group_members m WHERE m.group_id = c.official_group_id)
),
q AS (
  DELETE FROM public.city_launch_queue q WHERE q.city_id IN (SELECT city_id FROM doomed)
),
g AS (
  UPDATE public.cities SET official_group_id = NULL WHERE id IN (SELECT city_id FROM doomed)
),
gd AS (
  DELETE FROM public.groups WHERE id IN (SELECT group_id FROM doomed)
)
DELETE FROM public.cities WHERE id IN (SELECT city_id FROM doomed);