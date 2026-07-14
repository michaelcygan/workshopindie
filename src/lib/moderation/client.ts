import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo } from "react";
import { getModerationClientBundle } from "./bundle.functions";
import { check, checkSpam, compileMatcher, MODERATION_MESSAGES, type SpamOpts } from "./engine";

/**
 * Client-side pre-check for UX only. NEVER treat "ok" as authorization —
 * the server re-runs the same engine on every write.
 */
export function useModerationChecker() {
  const fetchBundle = useServerFn(getModerationClientBundle);
  const { data } = useQuery({
    queryKey: ["moderation", "bundle"],
    queryFn: () => fetchBundle(),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const matcher = useMemo(() => {
    if (!data) return null;
    return compileMatcher(data);
  }, [data]);

  return useMemo(() => {
    return {
      ready: !!matcher,
      check(text: string, spam?: SpamOpts): { ok: true } | { ok: false; message: string } {
        if (!matcher) return { ok: true };
        const r = check(text, matcher);
        if (!r.ok && r.severity === "block") {
          return { ok: false, message: MODERATION_MESSAGES[r.category] };
        }
        if (spam) {
          const s = checkSpam(text, spam);
          if (!s.ok && s.severity === "block") {
            return { ok: false, message: MODERATION_MESSAGES.spam };
          }
        }
        return { ok: true };
      },
    };
  }, [matcher]);
}
