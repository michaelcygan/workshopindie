import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { getRelatedPosts } from "@/lib/blog.functions";
import { subscribeToNewsletter } from "@/lib/newsletter.functions";

type Mode = "peek" | "article";

export function BlogArticleFooter({
  postId,
  mode,
  onSelectPost,
}: {
  postId: string;
  mode: Mode;
  onSelectPost?: (slug: string) => void;
}) {
  const { user } = useAuth();
  const subscribe = useServerFn(subscribeToNewsletter);
  const related = useServerFn(getRelatedPosts);

  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: relatedPosts } = useQuery({
    queryKey: ["blog-related", postId],
    queryFn: () => related({ data: { excludeId: postId, limit: 3 } }),
    staleTime: 60_000,
  });

  async function onSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    try {
      await subscribe({
        data: {
          email: email.trim(),
          website,
          source: mode === "peek" ? "blog_peek" : "blog_article",
        },
      });
      toast.success("Thanks — you're on the list.");
      setEmail("");
    } catch {
      toast.success("Thanks — you're on the list.");
      setEmail("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Conversion + Newsletter */}
      <aside className="mt-12 rounded-3xl border border-border bg-surface p-6 md:p-8">
        <h3 className="font-display text-2xl text-ink md:text-3xl">Make something with people.</h3>
        <p className="mt-2 text-ink-soft">
          Create a free portfolio, find collaborators, and join creative communities.
        </p>
        <div className="mt-4">
          {user ? (
            <Link
              to="/me"
              className="inline-flex items-center rounded-full border border-border bg-surface px-5 py-2 text-sm font-medium text-ink hover:bg-muted"
            >
              Go to your profile
            </Link>
          ) : (
            <Link
              to="/signup"
              className="gradient-motion inline-flex items-center rounded-full px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Join Workshop
            </Link>
          )}
        </div>

        <form onSubmit={onSubscribe} className="mt-6 max-w-md">
          <label className="block text-xs font-medium uppercase tracking-wider text-ink-muted">
            Notes from Workshop
          </label>
          <p className="mt-1 text-sm text-ink-soft">
            Occasional notes on independent art, creative collaboration, and what's happening on Workshop.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
              autoComplete="email"
            />
            <input
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="hidden"
              aria-hidden="true"
              name="website"
            />
            <button
              type="submit"
              disabled={busy}
              className="gradient-motion rounded-full px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
            >
              {busy ? "…" : "Subscribe"}
            </button>
          </div>
        </form>
      </aside>

      {/* Related */}
      {relatedPosts && relatedPosts.length > 0 && (
        <section className="mt-12">
          <h3 className="mb-4 font-display text-xl text-ink">More from the blog</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {relatedPosts.map((r) => {
              const inner = (
                <>
                  {r.cover_image_url && (
                    <img
                      src={r.cover_image_url}
                      alt={r.cover_image_alt ?? r.title}
                      className="mb-3 aspect-video w-full rounded-xl object-cover"
                      loading="lazy"
                    />
                  )}
                  <div className="font-display text-base text-ink group-hover:underline">{r.title}</div>
                  {r.excerpt && (
                    <div className="mt-1 line-clamp-2 text-sm text-ink-muted">{r.excerpt}</div>
                  )}
                </>
              );
              const className =
                "group block rounded-2xl border border-border bg-surface p-4 text-left hover:bg-muted";
              if (mode === "peek" && onSelectPost) {
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onSelectPost(r.slug)}
                    className={className}
                  >
                    {inner}
                  </button>
                );
              }
              return (
                <Link
                  key={r.id}
                  to="/blog/$slug"
                  params={{ slug: r.slug }}
                  className={className}
                >
                  {inner}
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
