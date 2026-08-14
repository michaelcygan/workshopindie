DROP POLICY IF EXISTS "author updates doc comment" ON public.workshop_doc_comments;
CREATE POLICY "author updates doc comment"
ON public.workshop_doc_comments
FOR UPDATE
TO authenticated
USING (author_id = auth.uid() AND public.is_workshop_member(workshop_id, auth.uid()))
WITH CHECK (author_id = auth.uid() AND public.is_workshop_member(workshop_id, auth.uid()));