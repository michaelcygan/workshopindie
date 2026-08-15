ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS publication_date date,
  ADD COLUMN IF NOT EXISTS category_id text,
  ADD COLUMN IF NOT EXISTS subjects text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS materials text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.works.publication_date IS 'Official public release/premiere/issue date of the Work. Never derived from published_at (which is when it was posted to Workshop).';
COMMENT ON COLUMN public.works.category_id IS 'Stable Work Category registry id (precise kind, e.g. trailer). Medium stays in category_canonical.';

CREATE INDEX IF NOT EXISTS works_subjects_gin ON public.works USING gin (subjects);
CREATE INDEX IF NOT EXISTS works_materials_gin ON public.works USING gin (materials);
CREATE INDEX IF NOT EXISTS works_category_id_idx ON public.works (category_id) WHERE category_id IS NOT NULL;

UPDATE public.works
   SET publication_date = book_published_on
 WHERE book_published_on IS NOT NULL
   AND publication_date IS NULL;