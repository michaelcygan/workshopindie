import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";
import { DomainError } from "@/lib/errors";
import { emitOpLog } from "@/lib/obs/log";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  const started = Date.now();
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    // A DomainError that reaches here was already logged by withOpLog at the
    // operation that raised it, and it is an expected refusal — re-throw so
    // the caller still gets its message instead of a generic error page.
    if (error instanceof DomainError) throw error;
    // Anything else is a defect: record it as UNHANDLED so it can be counted
    // and alerted on separately from ordinary refusals.
    emitOpLog({ op: "request", result: "UNHANDLED", ms: Date.now() - started });
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
}));
