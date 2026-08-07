import { Link } from "@tanstack/react-router";
import { PenLine, Files } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

/**
 * Owner-only shortcuts on a published post: jump into the editor for this
 * post, or into the member's blog dashboard. Presentational gate only — the
 * editor route enforces access server-side.
 */
export function BlogAuthorActions({
  postId,
  createdBy,
  authorProfileId,
}: {
  postId: string;
  createdBy?: string | null;
  authorProfileId?: string | null;
}) {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  const owns = user.id === createdBy || user.id === authorProfileId;
  if (!owns) return null;

  return (
    <span className="ml-3 inline-flex flex-wrap items-center gap-2 align-middle">
      <Button asChild size="sm" variant="outline" className="rounded-full">
        <Link to="/me/blog/$id" params={{ id: postId }}>
          <PenLine className="size-3.5" />
          Edit post
        </Link>
      </Button>
      <Button asChild size="sm" variant="ghost" className="rounded-full">
        <Link to="/me/blog">
          <Files className="size-3.5" />
          My posts
        </Link>
      </Button>
    </span>
  );
}
