ALTER TABLE public.blog_posts DROP CONSTRAINT IF EXISTS blog_posts_category_slug_check;
ALTER TABLE public.blog_posts ADD CONSTRAINT blog_posts_category_slug_check CHECK (category_slug = ANY (ARRAY[
  'general','music','film-video','writing','visual-art','design','performance',
  'journalism-media','software-ai','making-engineering','science-research',
  'architecture-urbanism','environment-nature',
  'games-tech'
]));

ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS subcategories TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS specialties TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE public.group_events ADD COLUMN IF NOT EXISTS subcategory TEXT;

CREATE INDEX IF NOT EXISTS blog_posts_subcategories_idx ON public.blog_posts USING GIN (subcategories);
CREATE INDEX IF NOT EXISTS profiles_specialties_idx ON public.profiles USING GIN (specialties);
CREATE INDEX IF NOT EXISTS works_subcategories_idx ON public.works USING GIN (subcategories);
CREATE INDEX IF NOT EXISTS collab_posts_subcategories_idx ON public.collab_posts USING GIN (subcategories);