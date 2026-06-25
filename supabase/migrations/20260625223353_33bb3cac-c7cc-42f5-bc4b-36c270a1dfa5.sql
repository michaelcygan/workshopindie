
ALTER TABLE public.groups
  ADD COLUMN IF NOT EXISTS parent_group_id uuid NULL REFERENCES public.groups(id) ON DELETE SET NULL;

ALTER TABLE public.groups
  DROP CONSTRAINT IF EXISTS groups_parent_not_self;
ALTER TABLE public.groups
  ADD CONSTRAINT groups_parent_not_self CHECK (parent_group_id IS NULL OR parent_group_id <> id);

CREATE INDEX IF NOT EXISTS idx_groups_parent_group_id
  ON public.groups (parent_group_id)
  WHERE parent_group_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.tg_groups_enforce_single_level_nesting()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_has_parent boolean;
  has_children boolean;
BEGIN
  IF NEW.parent_group_id IS NOT NULL THEN
    -- The chosen parent must not itself be a child.
    SELECT (parent_group_id IS NOT NULL) INTO parent_has_parent
      FROM public.groups WHERE id = NEW.parent_group_id;
    IF parent_has_parent THEN
      RAISE EXCEPTION 'Cannot nest under a group that already has a parent (single-level nesting only)';
    END IF;

    -- This group must not already have its own children.
    SELECT EXISTS(SELECT 1 FROM public.groups WHERE parent_group_id = NEW.id)
      INTO has_children;
    IF has_children THEN
      RAISE EXCEPTION 'This group already has child groups; it cannot become a child itself';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_groups_enforce_single_level_nesting ON public.groups;
CREATE TRIGGER tg_groups_enforce_single_level_nesting
  BEFORE INSERT OR UPDATE OF parent_group_id ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_groups_enforce_single_level_nesting();
