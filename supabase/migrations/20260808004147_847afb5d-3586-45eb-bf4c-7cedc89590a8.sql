-- Tracking links: named, measurable Workshop URLs for campaigns and physical placements.
-- Deliberately separate from workshop_links (/w/:token) and group_seed_links.
CREATE TABLE public.tracking_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  destination_path text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tracking_links_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 2 AND 80),
  CONSTRAINT tracking_links_name_len CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  -- Internal Workshop destinations only. Never an open redirect, never a /go loop.
  CONSTRAINT tracking_links_destination_internal CHECK (
    destination_path ~ '^/[A-Za-z0-9_\-./?&=%~+:,@!$''()*;\[\]]*$'
    AND destination_path !~ '^//'
    AND destination_path !~ '^/go/'
    AND destination_path <> '/go'
    AND length(destination_path) <= 500
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracking_links TO authenticated;
GRANT ALL ON public.tracking_links TO service_role;

ALTER TABLE public.tracking_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage tracking_links"
  ON public.tracking_links
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_tracking_links_created ON public.tracking_links (created_at DESC);
CREATE INDEX idx_tracking_links_active ON public.tracking_links (is_active) WHERE is_active;

CREATE TRIGGER update_tracking_links_updated_at
  BEFORE UPDATE ON public.tracking_links
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- One row per redirect request. Campaign attribution only: no IP, no user id,
-- no fingerprint, no per-person browsing history.
CREATE TABLE public.tracking_link_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_link_id uuid NOT NULL REFERENCES public.tracking_links(id) ON DELETE CASCADE,
  visitor_type text NOT NULL DEFAULT 'guest',
  city text,
  region text,
  country text,
  referrer text,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tracking_link_clicks_visitor_type CHECK (visitor_type IN ('member', 'guest'))
);

GRANT SELECT ON public.tracking_link_clicks TO authenticated;
GRANT ALL ON public.tracking_link_clicks TO service_role;

ALTER TABLE public.tracking_link_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read tracking_link_clicks"
  ON public.tracking_link_clicks
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_tracking_link_clicks_link_time
  ON public.tracking_link_clicks (tracking_link_id, clicked_at DESC);
CREATE INDEX idx_tracking_link_clicks_time
  ON public.tracking_link_clicks (clicked_at DESC);