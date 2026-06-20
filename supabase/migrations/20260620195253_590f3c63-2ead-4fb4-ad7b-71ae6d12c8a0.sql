ALTER TYPE public.category ADD VALUE IF NOT EXISTS 'writing_book';

ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS book_author text,
  ADD COLUMN IF NOT EXISTS book_publisher text,
  ADD COLUMN IF NOT EXISTS book_isbn text,
  ADD COLUMN IF NOT EXISTS book_published_on date,
  ADD COLUMN IF NOT EXISTS book_page_count integer,
  ADD COLUMN IF NOT EXISTS book_buy_links jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS book_excerpt_url text;