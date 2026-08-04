# Flat desktop nav for signed-in members

Replace the current signed-in desktop navigation (Groups dropdown, Collabs, "More" dropdown) with a single flat row of five links, no dropdowns:

Blog · Groups · Collabs · Gallery · Events

## What changes

- The signed-in center nav renders five plain links in that order, using the same link styling and active state as the logged-out nav.
- The "More" menu (Events / Gallery / Blog) is removed.
- The Groups entry becomes a plain link to the Groups index for everyone, including members who have joined groups — the "Your groups" shortcut list in that dropdown goes away with it.
- Nothing changes for logged-out desktop nav, mobile nav, the Create button, or the account menu.

## Technical notes

- `src/components/top-nav.tsx`: replace the signed-in branch of the center `<nav>` with the five links; delete the local `MoreNavMenu` component and its now-unused icon/dropdown imports.
- `src/components/groups-nav-item.tsx`: no longer used by the top nav. Since the flat row uses a plain `<Link to="/groups">`, this component gets dropped from the nav; remove the file if no other surface imports it, otherwise leave it in place untouched.
