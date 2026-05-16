/**
 * Trust-layer display: "Jane S." when we have first + last name,
 * otherwise falls back to display_name, then username, then "Someone".
 */
export type TrustNameInput = {
  first_name?: string | null;
  last_name?: string | null;
  display_name?: string | null;
  username?: string | null;
};

export function trustName(p: TrustNameInput | null | undefined): string {
  if (!p) return "Someone";
  const first = (p.first_name ?? "").trim();
  const last = (p.last_name ?? "").trim();
  if (first && last) return `${first} ${last[0].toUpperCase()}.`;
  if (first) return first;
  if (p.display_name?.trim()) return p.display_name.trim();
  if (p.username?.trim()) return `@${p.username.trim()}`;
  return "Someone";
}

export function sanitizeInstagramHandle(input: string): string {
  return input
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_.]/g, "")
    .slice(0, 30);
}
