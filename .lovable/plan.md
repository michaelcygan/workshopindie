# Connective tissue: Waves 7–10

The shared entity layer (kinds, parser, chip, visibility, search) is in place. These four waves
finish the pass by fixing the places where the *reverse* direction of a connection is still
inconsistent — where an object was tagged but the tag doesn't come back correctly, or comes back
labelled as something it isn't.

Each item below was confirmed against the current code and database before being written down.

## Wave 7 — Reverse references actually honor "trusted"

**Confirmed problem.** `listBlogPostsForEntityServer` implements the `trustedOnly` filter inside an
`if (kind === "work")` branch. Collab pages and Event pages both pass `trustedOnly`, but for those
kinds the flag does nothing — the filter block never runs. So "The story behind this Collab" and
"Stories from this Event" will show a post written by any unrelated member who tagged that Collab
or Event, presented with the authority of the object's own page.

**Fix.** Lift trust resolution out of the Work branch into one `resolveTrustedAuthorIds(kind, id)`
helper covering every kind:

- Work — creator plus credited collaborators (today's rule, unchanged).
- Collab — the collab owner plus accepted members.
- Event — the event's hosts and co-hosts, plus stewards/owners of the parent group.
- Group — group owners and stewards.
- Profile — the person themselves.

Workshop editorial posts (`publication_type !== 'member'`) stay trusted everywhere, as today. The
Work-specific credit role labels keep working. Untrusted posts are not deleted or hidden from the
Blog — they simply stop being echoed back onto the object's own page.

## Wave 8 — Profile rail says what it actually shows

**Confirmed problem.** The rail on a profile is headed `Stories by {name}` but is driven by
`kind: "profile"` tags, which mean "this post is *about* this person" — it includes posts written
by other people. Authored posts are a different surface entirely (`ProfileBlogTab`, fed by
`published_blog_count`).

Note: there are currently zero profile tags in the database, so this rail renders empty for
everyone today. This is a naming fix before the surface has content, not a visible regression.

**Fix.** Rename to `Stories about {name}`, adjust the empty copy to match, and keep the write
affordance owner-only. The Writing tab keeps its current meaning. Result: "Writing" = what they
wrote, "Stories about" = where the community wrote about them.

## Wave 9 — Group Blog surface uses the shared rules

`useGroupBlogPosts` merges tagged posts with member-authored posts and de-duplicates by id — that
composition is good and stays. Two alignments:

- Route the tagged half through the same trust resolution added in Wave 7, so a Group page echoes
  posts from its own people and editorial rather than anyone who tagged it.
- Group entity search in the Today composer and the Blog picker now share one implementation
  (done in Wave 3); this wave removes the last group-local search remnants so there is one code
  path left.

Ephemeral (Today, chat) and durable (tags, membership) references stay distinct — no Today mention
starts writing rows into `blog_post_entity_tags`.

## Wave 10 — DM inbox keeps the context the thread already has

**Confirmed problem.** `conversations` stores `context_work_id`, `context_collab_post_id`,
`context_workshop_id` and `context_comment_id`. The thread view (`dms.$conversationId.tsx`) reads
Work and Collab context and renders it. The inbox (`dms.index.tsx`) selects only
`context_collab_post_id` and `context_workshop_id` — so a DM opened from a Work shows a context
line inside the thread but nothing in the list, and the reason the conversation exists is lost at
exactly the moment you're scanning for it.

**Fix.** Read every context column in the inbox query, resolve them through the shared entity layer,
and render one small context line per row using the same chip vocabulary as the thread view.
Conversations with no context render exactly as they do now.

## Technical notes

- Files touched: `src/lib/blog-entity-tags.server.ts` (trust resolution), `src/routes/u.$username.tsx`
  (heading/copy), `src/components/group/group-posts-tab.tsx` (trusted tagged half),
  `src/routes/dms.index.tsx` (context columns + row rendering).
- No database migration. Every column and relationship these waves rely on already exists.
- New unit tests for `resolveTrustedAuthorIds` per kind, including the editorial bypass and the
  "unrelated tagger is excluded" case.
- No change to how tags are written, to publish-time visibility assertions, or to
  `invalidateEntityTagCaches`.

## Open question, defaulted

Reverse rails currently ignore `show_in_blog_index`, so a post the author unlisted from the public
Blog index still appears on a tagged object's page. I'm treating that as intentional (opting out of
the index is not the same as opting out of context) and leaving it alone. Say the word if it should
be respected instead.
