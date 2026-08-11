# Photos for 20 genre groups

All 35 city groups now carry brand-treated photography. The 66 non-city groups still fall back to the generic placeholder. This pass gives 20 genre (craft) groups a real, properly licensed photograph, processed exactly like the city set so everything reads as one system.

## The 20 groups

Photographers, Poets, Screenwriters, Comic Artists, Zine Makers, Ceramicists, Tattoo Artists, Type Designers, Knitwear Designers, Podcasters, Voice Actors, DJ / Club, Lo-fi Beatmakers, Bedroom Pop, SoundCloud Rappers, Documentary, Experimental Animation, Indie Game Devs, Stand-up Comics, Drag Performers.

## Source and licensing

- Photos come from Wikimedia Commons, restricted to public domain / CC0 / CC BY / CC BY-SA.
- One photo per group, chosen for the craft in motion rather than the object: a darkroom tray, hands centering clay, a tattoo station, a mic in a booth, a club floor, a comedy stage. No stock-looking posed portraits, no logos, no diagrams.
- Every file records source URL, author and license so attribution can be shown and re-checked.

## Brand treatment

Same pass the cities got, so the two sets sit together:

- Desaturated to near-monochrome with a slight cool cast.
- Wide banner crop for `cover_url`, square crop for `avatar_url`, same contrast curve and grain.
- Exported web-sized so pages stay fast.

## Where it shows up

No new UI — existing surfaces already read `cover_url` / `avatar_url`: group page hero, groups directory cards and rails, joined-groups rail, group chips and peeks. Attribution uses the existing credit line and `group_photo_credits` record, same as cities.

## Technical notes

- Extend the existing `scripts/geo/city-photos.py` pipeline (or a sibling script alongside it) with a genre-group list of slug + search terms, reusing the same license filter, treatment, and upload steps.
- Upload to the same public `covers` bucket under a `group/` prefix; attach by slug. Idempotent: re-running replaces the same paths.
- Insert one `group_photo_credits` row per group (source URL, author, license, license URL).
- Any group where no acceptable licensed photo is found keeps the placeholder and is reported rather than filled with something weak.

## Steps

1. Search and license-verify candidates for all 20 groups; review picks.
2. Treat, crop, and upload covers + avatars.
3. Attach to `groups` and record credits.
4. Spot-check the groups directory, a few group pages, and mobile; report any group left without a photo.
