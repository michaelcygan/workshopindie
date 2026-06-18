
CREATE TABLE public.workshop_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  title text NOT NULL,
  prompt text,
  category public.category,
  cover_url text,
  participant_cap integer NOT NULL DEFAULT 5,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX workshop_links_token_idx ON public.workshop_links (token);

GRANT SELECT ON public.workshop_links TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.workshop_links TO authenticated;
GRANT ALL ON public.workshop_links TO service_role;

ALTER TABLE public.workshop_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active links are publicly readable"
  ON public.workshop_links FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage links"
  ON public.workshop_links FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.workshop_links_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER workshop_links_set_updated_at
  BEFORE UPDATE ON public.workshop_links
  FOR EACH ROW EXECUTE FUNCTION public.workshop_links_touch_updated_at();

ALTER TABLE public.instant_rooms ADD COLUMN link_token text;
CREATE INDEX instant_rooms_link_token_idx ON public.instant_rooms (link_token) WHERE link_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.join_link_workshop(
  _user_id uuid,
  _token text,
  _exclude_room_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_link public.workshop_links%ROWTYPE;
  v_room_id uuid;
  v_cutoff timestamptz := now() - interval '60 seconds';
BEGIN
  SELECT * INTO v_link FROM public.workshop_links
    WHERE token = _token AND is_active = true
    LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Link not found or inactive';
  END IF;

  SELECT r.id INTO v_room_id
  FROM public.instant_rooms r
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS live_count
    FROM public.instant_presence p
    WHERE p.room_id = r.id AND p.last_seen_at > v_cutoff
  ) pres ON true
  WHERE r.link_token = _token
    AND r.status = 'active'
    AND r.locked = false
    AND NOT (r.id = ANY(_exclude_room_ids))
    AND COALESCE(pres.live_count, 0) < r.participant_cap
  ORDER BY COALESCE(pres.live_count, 0) DESC, r.created_at ASC
  LIMIT 1;

  IF v_room_id IS NULL THEN
    INSERT INTO public.instant_rooms (
      kind, title, status, participant_cap, creator_id, host_user_id,
      medium, category, prompt, visibility, link_token
    ) VALUES (
      'lounge', v_link.title, 'active', v_link.participant_cap, NULL, NULL,
      v_link.category, v_link.category, v_link.prompt, 'open', _token
    )
    RETURNING id INTO v_room_id;
  END IF;

  RETURN v_room_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_link_workshop(uuid, text, uuid[]) TO authenticated, service_role;
