/**
 * Cheap, static page labels for the admin live row.
 *
 * Deliberately lookup-free: a handful of known surfaces plus a slug prettifier.
 * Anything unknown falls back to the raw path — a label is never worth a query.
 */

const STATIC: Record<string, string> = {
  "/": "Home",
  "/blog": "Workshop Blog",
  "/groups": "Groups",
  "/events": "Events",
  "/collab": "Collab",
  "/works": "Works",
  "/pricing": "Pricing",
  "/about": "About",
};

function pretty(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0]!.toUpperCase() + w.slice(1)))
    .join(" ");
}

export function pageLabel(path: string): string {
  if (!path) return "—";
  const known = STATIC[path];
  if (known) return known;

  const seg = path.split("/").filter(Boolean);
  if (seg.length === 2 && seg[0] === "g") return pretty(seg[1]!);
  if (seg.length === 2 && seg[0] === "blog") return pretty(seg[1]!);
  if (seg.length === 1 && seg[0] === "g") return "Groups";
  return path;
}
