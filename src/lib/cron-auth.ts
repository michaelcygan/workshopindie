/**
 * Shared auth check for cron-invoked `/api/public/*` sweep endpoints.
 *
 * A scheduler may authenticate either way:
 *  - `apikey: <publishable/anon key>`  (the standard pg_cron pattern here)
 *  - `x-cron-secret: <CRON_SECRET>`    (legacy jobs)
 *
 * Returns a 403 Response when neither credential matches, otherwise null.
 *
 * Use in a server route handler:
 *   const denied = requireCronSecret(request);
 *   if (denied) return denied;
 */
function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

export function requireCronSecret(request: Request): Response | null {
  const apiKey = request.headers.get("apikey");
  const expectedKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
  if (apiKey && expectedKey && constantTimeEquals(expectedKey, apiKey)) return null;

  const expectedSecret = process.env.CRON_SECRET ?? "";
  const provided = request.headers.get("x-cron-secret");
  if (provided && expectedSecret && constantTimeEquals(expectedSecret, provided)) return null;

  return new Response("Forbidden", { status: 403 });
}
