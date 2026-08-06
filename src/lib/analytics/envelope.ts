/**
 * Analytics response envelope.
 *
 * A failed query must never render as a convincing zero. Every analytics
 * payload carries a status so the UI can distinguish:
 *   ok           — the data is real
 *   unavailable  — the query failed; show "Data unavailable"
 *   empty        — the query succeeded and there is genuinely nothing yet
 */

export type PanelStatus = "ok" | "unavailable" | "empty";

export type Panel<T> = {
  data: T | null;
  status: PanelStatus;
  error?: string;
};

export function ok<T>(data: T): Panel<T> {
  const isEmpty =
    data === null || data === undefined || (Array.isArray(data) && data.length === 0);
  return { data, status: isEmpty ? "empty" : "ok" };
}

export function unavailable<T>(error?: string): Panel<T> {
  return { data: null, status: "unavailable", ...(error ? { error } : {}) };
}

type Supabaseish = PromiseLike<{ data: any; error: { message: string } | null }>;

/** Wrap a Supabase query so failures surface as `unavailable`, not as zeros. */
export async function panel<T = any>(query: Supabaseish): Promise<Panel<T>> {
  try {
    const res = await query;
    if (res.error) return unavailable<T>(res.error.message);
    return ok((res.data ?? null) as T);
  } catch (e) {
    return unavailable<T>(e instanceof Error ? e.message : "Query failed");
  }
}

export function isOk<T>(p: Panel<T> | undefined | null): p is Panel<T> & { data: T } {
  return !!p && p.status !== "unavailable" && p.data !== null;
}

/** Read a numeric field from a single-row panel, or null when unavailable. */
export function num(p: Panel<any> | undefined | null, key: string): number | null {
  if (!isOk(p)) return null;
  const v = (p.data as any)?.[key];
  return typeof v === "number" ? v : null;
}

export function rows<T>(p: Panel<T[]> | undefined | null): T[] {
  return isOk(p) ? (p.data as T[]) : [];
}
