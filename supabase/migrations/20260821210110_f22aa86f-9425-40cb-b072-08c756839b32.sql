CREATE OR REPLACE FUNCTION public.get_or_create_conversation(
  _other uuid,
  _context_collab_post_id uuid DEFAULT NULL::uuid,
  _context_workshop_id uuid DEFAULT NULL::uuid,
  _context_work_id uuid DEFAULT NULL::uuid,
  _context_comment_id uuid DEFAULT NULL::uuid,
  _context_open_house_application_id uuid DEFAULT NULL::uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _a uuid;
  _b uuid;
  _id uuid;
BEGIN
  IF _uid IS NULL OR _other IS NULL OR _uid = _other THEN
    RAISE EXCEPTION 'invalid_conversation';
  END IF;

  IF _uid < _other THEN _a := _uid; _b := _other; ELSE _a := _other; _b := _uid; END IF;

  INSERT INTO public.conversations (
    user_a, user_b, context_collab_post_id, context_workshop_id, context_work_id,
    context_comment_id, context_open_house_application_id
  ) VALUES (
    _a, _b, _context_collab_post_id, _context_workshop_id, _context_work_id,
    _context_comment_id, _context_open_house_application_id
  )
  ON CONFLICT (user_a, user_b) DO NOTHING
  RETURNING id INTO _id;

  IF _id IS NULL THEN
    SELECT id INTO _id FROM public.conversations WHERE user_a = _a AND user_b = _b;
    -- Attach newly supplied context to an existing thread so the reason for the
    -- conversation is visible even when the pair already had one.
    IF _context_open_house_application_id IS NOT NULL THEN
      UPDATE public.conversations
         SET context_open_house_application_id = _context_open_house_application_id
       WHERE id = _id AND context_open_house_application_id IS DISTINCT FROM _context_open_house_application_id;
    END IF;
  END IF;

  RETURN _id;
END;
$function$;