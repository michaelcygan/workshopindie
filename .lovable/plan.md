## Fix Screen Share / Recorder errors in instant rooms

**Root cause**: Last migration updated `workshop_tools_tool_type_check` but `instant_tools_tool_type_check` still only allows `pinboard, shot_list, track_list, outline, repo_links, list, drive, docs, board`. Inserting `screen_share` or `recorder` in an instant room throws the violation toast shown in the screenshots.

## Change

One migration:

```sql
ALTER TABLE public.instant_tools DROP CONSTRAINT instant_tools_tool_type_check;
ALTER TABLE public.instant_tools ADD CONSTRAINT instant_tools_tool_type_check
  CHECK (tool_type = ANY (ARRAY[
    'pinboard','shot_list','track_list','outline','repo_links',
    'list','drive','docs','board','screen_share','recorder'
  ]));
```

No code changes — `workshop_tools` already accepts both values, and the tools panel already passes `screen_share` / `recorder`.

## Verify
Open an instant Workshop room → enable Screen Share, then Recorder. No constraint toast; both panels mount.