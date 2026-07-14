import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { redeemWorkInviteToken } from "@/lib/works.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/works/invite/$token")({
  component: AcceptWorkInvite,
});

function AcceptWorkInvite() {
  const { token } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const redeemFn = useServerFn(redeemWorkInviteToken);
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    if (status !== "idle") return;
    setStatus("working");
    redeemFn({ data: { token } })
      .then((res: { slug: string | null }) => {
        if (res.slug) {
          navigate({ to: "/works/$slug", params: { slug: res.slug } });
        } else {
          setStatus("error");
          setError("Couldn't find that Work.");
        }
      })
      .catch((e: unknown) => {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Invite couldn't be redeemed");
      });
  }, [loading, user, token, redeemFn, navigate, status]);

  if (loading) {
    return <div className="container mx-auto p-8 text-muted-foreground">Loading…</div>;
  }
  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-md">
        <Card className="p-6 space-y-4">
          <h1 className="text-xl font-semibold">You've been invited to a piece</h1>
          <p className="text-sm text-muted-foreground">
            Sign in or create an account to accept this invite. You'll sign the active rights agreement when you join.
          </p>
          <div className="flex gap-2">
            <Button asChild className="flex-1">
              <Link to="/login" search={{ next: `/works/invite/${token}` } as any}>Sign in</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link to="/signup" search={{ next: `/works/invite/${token}` } as any}>Create account</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <Card className="p-6 space-y-3">
        {status === "working" && (
          <>
            <Loader2 className="size-5 animate-spin" />
            <p className="text-sm text-muted-foreground">Adding you to the Work…</p>
          </>
        )}
        {status === "error" && (
          <>
            <h1 className="text-lg font-semibold">Invite couldn't be used</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button asChild variant="outline"><Link to="/me">Back to your stuff</Link></Button>
          </>
        )}
      </Card>
    </div>
  );
}
