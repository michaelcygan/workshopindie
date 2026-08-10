CREATE TABLE public.resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  useful_for text,
  short_description text,
  website_url text,
  location_text text,
  address text,
  image_url text,
  city_id uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  fields text[] NOT NULL DEFAULT '{}',
  created_by uuid,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.resources TO anon;
GRANT SELECT ON public.resources TO authenticated;
GRANT ALL ON public.resources TO service_role;

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published resources are viewable by everyone"
ON public.resources FOR SELECT
USING (is_published OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage resources"
ON public.resources FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.group_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  resource_id uuid NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, resource_id)
);

CREATE INDEX group_resources_group_idx ON public.group_resources(group_id, display_order);
CREATE INDEX group_resources_resource_idx ON public.group_resources(resource_id);

GRANT SELECT ON public.group_resources TO anon;
GRANT SELECT ON public.group_resources TO authenticated;
GRANT ALL ON public.group_resources TO service_role;

ALTER TABLE public.group_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Group resource links are viewable by everyone"
ON public.group_resources FOR SELECT
USING (true);

CREATE POLICY "Admins manage group resource links"
ON public.group_resources FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_resources_updated_at
BEFORE UPDATE ON public.resources
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();