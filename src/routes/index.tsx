import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { PublicHome } from "@/components/home/public-home";
import { MemberHome } from "@/components/home/member-home";
import { Skeleton } from "@/components/ui/skeleton";

const TITLE = "Workshop — Make things with other people";
const DESCRIPTION =
  "Workshop is a creative network for people who actually make things: post Work, credit collaborators, open Collabs, host Group audio, and write the stories behind the work.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

/**
 * Home is two distinct surfaces, never a conditional monolith:
 *  - logged out → the public, SEO-facing marketing/discovery page
 *  - signed in  → the member "state of your network" home
 *
 * The auth-loading branch renders a neutral shell so a member never sees the
 * logged-out page flash before their own home resolves.
 */
function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <Skeleton className="h-10 w-64" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-40 rounded-3xl" />
          ))}
        </div>
      </main>
    );
  }

  return <main>{user ? <MemberHome /> : <PublicHome />}</main>;
}
