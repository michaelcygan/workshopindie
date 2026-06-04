
-- Files are stored at path: {work_id}/{rest_of_path}
-- The first path segment is the work UUID; only collaborators on that work can access.

CREATE POLICY "work files: members read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'work-files'
    AND public.is_work_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "work files: members upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'work-files'
    AND public.is_work_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "work files: members update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'work-files'
    AND public.is_work_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "work files: owner deletes"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'work-files'
    AND public.is_work_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );
