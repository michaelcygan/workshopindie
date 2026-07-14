/**
 * Shared secret check for cron-invoked `/api/public/*` sweep endpoints.
 *
 * pg_cron (or any other scheduler) must send `x-cron-secret: <CRON_SECRET>`
 * with every POST. Without the header, or when `CRON_SECRET` is not
 * configured on the server, the handler returns 403 and performs no work.
 *
 * Use in a server route handler:
 *   const denied = requireCronSecret(request);
 *   if (denied) return denied;
 */
export function requireCronSecret(request: Request): Response | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return new Response("Forbidden: cron secret not configured", { status: 403 });
  }
  const provided = request.headers.get("x-cron-secret");
  if (!provided || provided.length !== expected.length) {
    return new Response("Forbidden", { status: 403 });
  }
  // Constant-time compare to avoid trivial timing leaks.
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  if (mismatch !== 0) {
    return new Response("Forbidden", { status: 403 });
  }
  return null;
}
