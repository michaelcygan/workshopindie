
ALTER TABLE public.works
  ADD COLUMN IF NOT EXISTS cover_aspect text NOT NULL DEFAULT 'portrait'
    CHECK (cover_aspect IN ('square','landscape','portrait')),
  ADD COLUMN IF NOT EXISTS cover_focal_x smallint NOT NULL DEFAULT 50
    CHECK (cover_focal_x BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS cover_focal_y smallint NOT NULL DEFAULT 50
    CHECK (cover_focal_y BETWEEN 0 AND 100);
