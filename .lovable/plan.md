## What I found

Two flavors of fix: (a) the post-simplification residue ("on a clock", "ship a Work", "Schedule a Workshop") that no longer matches the launch flow, and (b) LLM-flavored copy that sounds like a system describing itself instead of a person talking about the product.

## Copy edits

### Home (`src/routes/index.tsx`)

| Where | Now | Proposed |
|---|---|---|
| Hero subhead | "Make something with other artists — live, or on a clock." | "Make something with other artists. Find them, build it, ship it." |
| Workshop card body | "Live room with up to 5 artists, right now. Voice or video — meet your people." | "A live room. Up to 5 artists, voice or video. Walk in, meet people, get to work." |
| Collab card body | "The project you've been sitting on. List the roles, find the people." | "Got an idea sitting in your drafts? Post it. List the roles you need. People show up." |
| Gallery empty headline | "Be the first to ship a Work." | "Nothing here yet — go make something." |
| Gallery empty body | "Drop into a Workshop, meet your people, make something." | "Drop into a Workshop. Meet people. Build something worth showing." |
| Open Collab calls body | "Projects looking for people. Apply for a role." | "Real projects, real roles. Jump on one." |

### Workshop room landing (`src/routes/instant.index.tsx`)

| Where | Now | Proposed |
|---|---|---|
| Subhead | "Drop into a live room with up to 5 artists. We'll find you a seat — there's always one open." | "Walk into a live room with up to 5 artists. A seat opens up — take it." |

### Collab Board (`src/routes/collab.index.tsx`)

| Where | Now | Proposed |
|---|---|---|
| Subhead | "Ideas already in motion that need people. No clock — just open calls." | "Projects looking for people. Find one. Pitch yourself." |
| Empty body | "Be the first — post the idea you've been sitting on and the roles you need." | "Be the first. Post your idea, list the roles you need, see who shows up." |

### Auth (`src/routes/signup.tsx`)

| Where | Now | Proposed |
|---|---|---|
| Tagline | "Find people. Make the thing. Show the Work." | "Find people. Make the thing. Show your Work." (mirrors the new hero) |

### Profile / dashboard (`src/routes/me.tsx`)

| Where | Now | Proposed |
|---|---|---|
| Credits empty body | "Ship a Workshop or publish a Work to start your portfolio." | "Publish a Work to start your portfolio." |
| Drafts empty body | "When you start a Work, unfinished pieces land here." | "Unfinished Works land here while you're still cooking." |
| Participating empty body | "Once a host confirms you, your seat shows up here." | "When you're in a room, it shows up here." |

## Flag (not changing in this pass)

The `/workshops` index page (`src/routes/workshops.index.tsx`) and the "Applications" / "Hosting" tabs in `/me` still expose the **scheduled Workshops** flow you said to hide before launch — copy like "Time-boxed creative sessions. Apply, show up, make the thing.", "Schedule a Workshop", "Pick a category, set a clock, define roles." Fixing the copy here would just polish a surface that's supposed to be hidden. Recommend a separate pass to hide those routes/tabs (keep the schema dormant), rather than rewording stale-flow language. Say the word and I'll handle it in the next turn.

## Out of scope

No code structure, layout, gradient, or icon changes — copy only.
