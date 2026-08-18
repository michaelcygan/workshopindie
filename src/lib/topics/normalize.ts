/**
 * Shared Topic normalization. Mirrors public.topic_normalize() in Postgres so
 * client, server, and database agree on when two labels are the same Topic.
 *
 * Rules: NFKC, trim, lowercase, collapse internal whitespace, normalize dash
 * variants, drop inconsequential terminal punctuation. Deliberately no
 * singularization — "Politics", "News", and "Archives" must survive intact.
 */
export function normalizeTopicKey(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFKC")
    .replace(/[\u2013\u2014\u2010\u2011\u2012\u2212]/g, "-")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^[\s.,;:!?]+|[\s.,;:!?]+$/g, "");
}

export const TOPIC_LABEL_MIN = 2;
export const TOPIC_LABEL_MAX = 60;

/** Human-readable label cleanup that keeps the creator's capitalization. */
export function cleanTopicLabel(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, TOPIC_LABEL_MAX);
}

export function topicLabelError(value: string): string | null {
  const label = cleanTopicLabel(value);
  if (label.length < TOPIC_LABEL_MIN) return "Topics need at least 2 characters.";
  if (/^https?:\/\//i.test(label) || /\s/.test(label) === false && label.includes("://"))
    return "Topics can't be links.";
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(label)) return "Topics can't contain control characters.";
  if (!/[\p{L}\p{N}]/u.test(label)) return "Topics need at least one letter or number.";
  return null;
}
