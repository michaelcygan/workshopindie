// Server-only multilingual hate-speech / slur filter.
// Intentionally focused on the worst racial, ethnic, religious, sexual-orientation,
// gender-identity, and ableist slurs — NOT a general "no swearing" filter.
// People can curse all they want; they can't direct hate at others on Workshop.
//
// Add new entries lowercase. We strip accents and non-letters before matching,
// then look for these as whole tokens or sub-tokens, so leetspeak ("n1gger") and
// punctuation ("n.i.g.g.e.r") get caught.

const SLURS: readonly string[] = [
  // English
  "nigger","nigga","chink","gook","spic","wetback","kike","yid","heeb",
  "faggot","fag","tranny","dyke","retard","retarded","raghead","towelhead",
  "paki","coon","jigaboo","sandnigger","wop","kraut","gypsy","gyppo","gippo",
  // Spanish / Portuguese
  "mariposa","maricon","maricón","puto","sudaca","panchito",
  "viado","bicha","macaco",
  // French
  "negre","nègre","bougnoule","feuj","pédé","pede","tarlouze","chinetoque",
  // German
  "neger","kanake","schwuchtel",
  // Italian
  "frocio","negro","terrone",
  // Russian / Slavic
  "жид","негр","хач","чурка","пидор","пидар","петух","даун",
  // Arabic transliterated
  "abeed","khawal","zamel",
  // Hindi / Urdu (transliterated)
  "chinki","chakka","hijra","kala",
  // Mandarin / Cantonese (latinized)
  "guizi","zhina","gweilo",
  // Japanese
  "チョン","支那",
  // Misc
  "kafir","goy","goyim",
] as const;

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    // strip accents
    .replace(/[\u0300-\u036f]/g, "")
    // common leetspeak swaps so n1gg3r matches
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/\$/g, "s")
    .replace(/@/g, "a")
    // collapse separators inside words ("n i g g e r", "n.i.g.g.e.r")
    .replace(/[\s._\-*+]+/g, "");
}

/**
 * Returns the first matched slur if `text` contains hate speech, otherwise null.
 * Used to block guest applications and share captions, not to scold users.
 */
export function findHateSlur(text: string | null | undefined): string | null {
  if (!text) return null;
  const haystack = normalize(text);
  for (const slur of SLURS) {
    const n = normalize(slur);
    if (n.length >= 3 && haystack.includes(n)) return slur;
  }
  return null;
}
