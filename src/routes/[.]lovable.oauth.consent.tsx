import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { KickerChip } from "@/components/kicker-chip";

// Beta OAuth namespace on supabase-js; wrap locally so TS is happy.
type OAuthDetails = {
  client?: { name?: string; client_id?: string; redirect_uris?: string[]; scope?: string } | null;
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult<T> = { data: T | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult<OAuthDetails>>;
  approveAuthorization: (id: string) => Promise<OAuthResult<{ redirect_url?: string; redirect_to?: string }>>;
  denyAuthorization: (id: string) => Promise<OAuthResult<{ redirect_url?: string; redirect_to?: string }>>;
};
const oauthApi = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/login", search: { redirect: next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-display text-2xl text-ink">Couldn't load this authorization request</h1>
      <p className="mt-2 text-sm text-ink-muted">{String((error as Error)?.message ?? error)}</p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? "an app";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauthApi().approveAuthorization(authorization_id)
      : await oauthApi().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-4">
        <KickerChip>Authorize</KickerChip>
      </div>
      <h1 className="font-display text-3xl leading-[1.05] text-ink md:text-4xl">
        Connect {clientName} to your Workshop account
      </h1>
      <p className="mt-3 text-sm text-ink-muted">
        This lets {clientName} use Workshop as you. It can call Workshop's enabled tools
        (searching Works, Collabs, Groups, and events) while you are signed in. This does not
        bypass Workshop's permissions — everything still runs under your account's access.
      </p>

      <div className="mt-6 rounded-3xl border border-border bg-surface p-8 shadow-soft">
        {details?.scopes && details.scopes.length > 0 && (
          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-ink-muted">Requested access</p>
            <ul className="mt-2 space-y-1 text-sm text-ink">
              {details.scopes.map((s) => (
                <li key={s}>• {s}</li>
              ))}
            </ul>
          </div>
        )}
        {error && (
          <p role="alert" className="mb-3 text-sm text-red-500">
            {error}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            className="w-full rounded-full"
            disabled={busy}
            onClick={() => decide(true)}
          >
            {busy ? "Working…" : `Approve & connect ${clientName}`}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-full"
            disabled={busy}
            onClick={() => decide(false)}
          >
            Cancel
          </Button>
        </div>
      </div>
    </main>
  );
}
