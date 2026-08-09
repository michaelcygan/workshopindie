CREATE TABLE public.group_photo_credits (
  group_id uuid PRIMARY KEY REFERENCES public.groups(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  source_title text,
  author text NOT NULL,
  license text NOT NULL,
  license_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.group_photo_credits TO anon;
GRANT SELECT ON public.group_photo_credits TO authenticated;
GRANT ALL ON public.group_photo_credits TO service_role;
ALTER TABLE public.group_photo_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Photo credits are readable by everyone"
  ON public.group_photo_credits FOR SELECT USING (true);
CREATE POLICY "Admins manage photo credits"
  ON public.group_photo_credits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));