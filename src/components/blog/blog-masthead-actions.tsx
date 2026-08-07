import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, PenLine, Plus } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { createMyBlogDraft } from "@/lib/blog-member.functions";

/**
 * Writer actions in the Blog masthead. Signed-in members only, and desktop
 * only — on mobile the action island already carries the create flow and the
 * masthead needs to stay quiet.
 *
 * "New post" mirrors /me/blog exactly: create a draft, jump into the editor.
 * Entitlement failures (monthly publish cap, no access) surface as the
 * server's own message.
 */
export function BlogMastheadActions() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createFn = useServerFn(createMyBlogDraft);

  const createMut = useMutation({
    mutationFn: () => createFn({ data: {} }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["my-blog-posts", user?.id] });
      navigate({ to: "/me/blog/$id", params: { id: (res as { id: string }).id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading || !user) return null;

  return (
    <div className="hidden shrink-0 items-center gap-2 md:flex">
      <Button asChild variant="outline" className="rounded-full">
        <Link to="/me/blog">
          <PenLine className="size-4" />
          My posts
        </Link>
      </Button>
      <Button
        className="rounded-full"
        disabled={createMut.isPending}
        onClick={() => createMut.mutate()}
      >
        {createMut.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Plus className="size-4" />
        )}
        New post
      </Button>
    </div>
  );
}
