CREATE OR REPLACE FUNCTION public.messages_recipient_read_only_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Sender may edit their own message freely (existing behaviour).
  IF OLD.sender_id = auth.uid() THEN
    RETURN NEW;
  END IF;

  -- A non-sender participant may ONLY stamp read_at. Everything else is frozen.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Recipients may only mark messages as read';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_recipient_read_only ON public.messages;
CREATE TRIGGER messages_recipient_read_only
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.messages_recipient_read_only_guard();

DROP POLICY IF EXISTS "recipient marks message read" ON public.messages;
CREATE POLICY "recipient marks message read"
  ON public.messages
  FOR UPDATE
  TO authenticated
  USING (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  )
  WITH CHECK (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;