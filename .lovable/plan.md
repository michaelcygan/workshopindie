Add a "Blog" entry to the mobile account dropdown menu (the one shown in the screenshot from `src/components/top-nav.tsx`), placed under the "Explore" section alongside Gallery and Events, using the `BookOpen` icon and linking to `/blog`.

This mirrors the existing desktop dropdown item added previously, ensuring mobile users have a one-tap path to the blog from anywhere in the app.

### Technical details
- File: `src/components/top-nav.tsx`
- Add a menu item in the Explore group: icon `BookOpen` from `lucide-react`, label "Blog", `to="/blog"`.
- No other navigation surfaces changed — the bottom tab island stays as Home / Lounge / Collabs / Groups / You per prior decisions.