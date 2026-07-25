import { useState } from "react";
import { Link, useMatches } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { subscribeToNewsletter } from "@/lib/newsletter.functions";

// Route pathname prefixes that should NOT show the shared footer.
const HIDE_PREFIXES = [
  "/admin",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/onboarding",
  "/checkout",
  "/dms",
  "/lounge/",         // /lounge/$id room; /lounge index still shows footer
  "/workshops/",      // /workshops/$slug and tool routes; /workshops index still shows footer
  "/w/",
  "/e/",
  "/redeem/",
  "/goodbye",
  "/.lovable",
  "/.well-known",
  "/.mcp",
];

function shouldHide(pathname: string): boolean {
  return HIDE_PREFIXES.some((p) =>
    p.endsWith("/") ? pathname.startsWith(p) : (pathname === p || pathname.startsWith(p + "/") || pathname === p),
  );
}

export function SiteFooter() {
  const matches = useMatches();
  const pathname = matches[matches.length - 1]?.pathname ?? "/";
  if (shouldHide(pathname)) return null;

  const { user } = useAuth();
  const subscribe = useServerFn(subscribeToNewsletter);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);

  async function onSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    try {
      await subscribe({ data: { email: email.trim(), website, source: "footer" } });
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
    <footer className="mt-16 border-t border-border/70 bg-surface-2/40">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16">
        <div className="grid gap-10 md:grid-cols-3">
          {/* Conversion */}
          <div className="md:col-span-2">
            <h2 className="font-display text-3xl leading-tight text-ink md:text-4xl">
              Make something with people.
            </h2>
            <p className="mt-3 max-w-xl text-ink-soft">
              Create a free portfolio, find collaborators, and join creative communities.
            </p>
            <div className="mt-5">
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

            {/* Newsletter */}
            <form onSubmit={onSubscribe} className="mt-8 max-w-md">
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
                {/* Honeypot — hidden from users, tempting to bots */}
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
          </div>

          {/* Links */}
          <div className="grid grid-cols-2 gap-6 text-sm">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">Explore</div>
              <ul className="mt-3 space-y-2">
                <li><Link to="/lounge" className="text-ink-soft hover:text-ink">Lounge</Link></li>
                <li><Link to="/g" className="text-ink-soft hover:text-ink">Groups</Link></li>
                <li><Link to="/collab" className="text-ink-soft hover:text-ink">Collabs</Link></li>
                <li><Link to="/events" className="text-ink-soft hover:text-ink">Events</Link></li>
                <li><Link to="/gallery" className="text-ink-soft hover:text-ink">Gallery</Link></li>
              </ul>
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wider text-ink-muted">More</div>
              <ul className="mt-3 space-y-2">
                <li><Link to="/blog" className="text-ink-soft hover:text-ink">Blog</Link></li>
                <li><Link to="/pricing" className="text-ink-soft hover:text-ink">Pricing</Link></li>
                <li><Link to="/refer" className="text-ink-soft hover:text-ink">Refer & Earn</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-border/70 pt-6 text-xs text-ink-muted md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full gradient-motion" />
            <span className="font-display text-sm text-ink">Workshop</span>
            <span>© {new Date().getFullYear()}</span>
          </div>
          <div className="text-ink-muted">Independent creative collaboration.</div>
        </div>
      </div>
    </footer>
  );
}
