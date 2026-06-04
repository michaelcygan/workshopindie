import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { claimGuestApplication } from "@/lib/collab.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/collab/claim/$token")({
  component: ClaimPage,
  head: () => ({ meta: [{ title: "Claim your application — Workshop" }] }),
});

function ClaimPage() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const claim = useServerFn(claimGuestApplication);
  const [state, setState] = useState<"idle" | "claiming" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user || state !== "idle") return;
    setState("claiming");
    claim({ data: { token } })
      .then(({ conversationId }) => {
        navigate({ to: "/dms/$conversationId", params: { conversationId }, replace: true });
      })
      .catch((e: Error) => {
        setError(e.message);
        setState("error");
      });
  }, [loading, user, token, claim, navigate, state]);

  if (loading) {
    return (
      <main className="mx-auto flex max-w-md items-center justify-center px-4 py-20 text-ink-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <Sparkles className="mx-auto h-8 w-8 text-amber-400" />
        <h1 className="mt-4 font-display text-3xl text-ink">Claim your application</h1>
        <p className="mt-2 text-sm text-ink-muted">
          Sign up (or sign in) to claim your application and message the host directly.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <Button
            className="rounded-full"
            onClick={() => navigate({ to: "/signup", search: { claim: token, from: "guest_apply" } as never })}
          >
            Create an account
          </Button>
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => navigate({ to: "/login", search: { claim: token } as never })}
          >
            I already have one
          </Button>
        </div>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="font-display text-2xl text-ink">Can't claim this one</h1>
        <p className="mt-2 text-sm text-ink-muted">{error}</p>
        <Button variant="outline" className="mt-6 rounded-full" onClick={() => navigate({ to: "/collab" })}>
          Browse the Collab Board
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-md items-center justify-center gap-2 px-4 py-20 text-ink-muted">
      <Loader2 className="h-4 w-4 animate-spin" /> Opening your conversation…
    </main>
  );
}
