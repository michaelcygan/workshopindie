import { z } from "zod";

/**
 * Turn a ZodError into one human sentence. Never surface raw issue JSON to
 * users — a toast full of `{"code":"invalid_format"}` tells them nothing.
 */
export function zodMessage(err: unknown, labels: Record<string, string> = {}): string {
  if (!(err instanceof z.ZodError)) {
    return err instanceof Error ? err.message : "Something went wrong.";
  }
  const issue = err.issues[0];
  if (!issue) return "Please check the form and try again.";
  const key = String(issue.path[0] ?? "");
  const label = labels[key];
  const base = issue.message || "Invalid input";
  return label ? `${label}: ${base}` : base;
}

/** Parse with a friendly error instead of a raw ZodError. */
export function parseFriendly<T extends z.ZodType>(
  schema: T,
  input: unknown,
  labels?: Record<string, string>,
): z.infer<T> {
  const res = schema.safeParse(input);
  if (!res.success) throw new Error(zodMessage(res.error, labels));
  return res.data;
}
