/**
 * Routes that render their own header/footer and must not show Workshop's
 * global chrome (top nav, mobile brand header, mobile nav, site footer).
 *
 * Kept in one place so all four chrome components agree.
 */
const CHROME_FREE_PREFIXES = ["/start-a-collab"];

export function isChromeFreePath(pathname: string): boolean {
  return CHROME_FREE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
