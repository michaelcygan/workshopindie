## Add blog-post tagging everywhere `@` is offered

Audit of tagging surfaces:

| Surface | Component | Posts currently included? |
|---|---|---|
| Lounge chat | `ChatMentionInput` | ✅ already |
| Event Wall | `ChatMentionInput` | ✅ already (via shared input) |
| DMs (1:1) | `MentionPopover` in `src/routes/dms.$conversationId.tsx` | ❌ missing |
| Group Today board | `TodayMentionPopover` → `MentionPopover` | ❌ missing (suggestions) + ❌ missing (rendering) |

Posts already exist as a `MentionKind` in `mention-suggestions.ts` and render as `PostChip` (opens `BlogPostPeek`) in `MessageBody`. The insert format is `[Title](/blog/<slug>) ` — identical to how collabs/works/groups already work.

### Changes

1. **`src/routes/dms.$conversationId.tsx`** (line 654) — add `"post"` to the `sections` array so `@` search over DMs returns blog posts. DMs already render bodies via shared `MessageBody`, which already knows how to draw `PostChip` + `BlogPostPeek`. No renderer change needed.

2. **`src/components/group/today-mention-popover.tsx`** — add `"post"` to `sections` (`["user","collab","group","event","work","post"]`) and update the comment.

3. **`src/lib/today-text.tsx`** — Today posts are rendered by `renderTodayBody`, not by `MessageBody`, so we also add post support here to match:
   - Add `POST_LINK_RE = /\[([^\]\n]{1,120})\]\(\/blog\/([a-zA-Z0-9_-]{1,120})\)/g`.
   - Add `{ type: "post"; label; slug }` to `Segment`.
   - Tokenize `POST_LINK_RE` alongside the other link kinds.
   - Render as a new `PostPill` — book/file icon, coral/violet-adjacent tint, opens `BlogPostPeek` in place (matches the "stay in the room" pattern). No navigation to `/blog/$slug`.
   - Include `POST_LINK_RE` in `flattenTodayBodyToText` so previews/snippets show the plain title.

### Not changed / out of scope

- Blog-post rendering already uses `BlogPostPeek`; consistent with the "don't jump around" rule. There's no case where clicking a tagged post should hard-navigate.
- `ChatMentionInput`, `MessageBody`, and `BlogPostPeek` are already wired end-to-end — no edits.
- No DB, no server functions.
