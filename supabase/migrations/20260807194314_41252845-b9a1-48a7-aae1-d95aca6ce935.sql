-- Missed by the previous pass because its actual signature differs from the
-- one assumed there; resolved from the catalog by name instead.
DO $$
DECLARE
  target regprocedure;
BEGIN
  FOR target IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.proname = 'try_consume_blog_publication'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', target);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', target);
  END LOOP;
END $$;
