import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ email: z.string().trim().email().max(255) });

/**
 * Existence probe used ONLY to route a person to the right form after a failed
 * credential attempt (sign in with no account / sign up with an account).
 * Returns nothing but a boolean — no profile data, no timing detail.
 */
export const checkEmailExists = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string }) => schema.parse(input))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    if (!url || !key) return { exists: null as boolean | null };

    try {
      const res = await fetch(
        `${url}/auth/v1/admin/users?page=1&per_page=1&filter=${encodeURIComponent(data.email)}`,
        { headers: { apikey: key, Authorization: `Bearer ${key}` } },
      );
      if (!res.ok) return { exists: null as boolean | null };
      const body = (await res.json()) as { users?: Array<{ email?: string | null }> };
      const target = data.email.toLowerCase();
      const exists = (body.users ?? []).some((u) => (u.email ?? "").toLowerCase() === target);
      return { exists: exists as boolean | null };
    } catch {
      return { exists: null as boolean | null };
    }
  });
