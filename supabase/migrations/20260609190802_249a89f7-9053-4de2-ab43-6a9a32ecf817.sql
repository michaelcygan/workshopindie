-- Add new enum values to tool_type so workshop_tools accepts them.
ALTER TYPE public.tool_type ADD VALUE IF NOT EXISTS 'list';
ALTER TYPE public.tool_type ADD VALUE IF NOT EXISTS 'drive';
ALTER TYPE public.tool_type ADD VALUE IF NOT EXISTS 'docs';
ALTER TYPE public.tool_type ADD VALUE IF NOT EXISTS 'board';