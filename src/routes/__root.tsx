import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { TopNav } from "@/components/top-nav";
import { MobileNav } from "@/components/mobile-nav";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { WelcomeTour } from "@/components/welcome-tour";
import { FirstRunHint } from "@/components/first-run-hint";
import { WorkshopLiveToast } from "@/components/workshop-live-toast";
import { RefCapture } from "@/components/ref-capture";
import { PresenceHeartbeat } from "@/components/presence-heartbeat";
import { AgeGate } from "@/components/age-gate";
import { usePendingRsvpFlush } from "@/hooks/use-pending-rsvp";
import { useTitleBadge } from "@/hooks/use-title-badge";
import { supabase } from "@/integrations/supabase/client";


import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-ink">404</h1>
        <h2 className="mt-4 text-xl text-ink">Lost in the studio</h2>
        <p className="mt-2 text-sm text-ink-muted">This page doesn't exist (yet).</p>
        <div className="mt-6">
          <Link to="/" className="gradient-motion inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Back to Gallery
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl text-ink">Something didn't load</h1>
        <p className="mt-2 text-sm text-ink-muted">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="gradient-motion rounded-full px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Try again
          </button>
          <a href="/" className="rounded-full border border-border bg-surface px-5 py-2 text-sm font-medium text-ink hover:bg-muted">
            Home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Workshop — Find people. Make things. Create a Portfolio." },
      { name: "description", content: "Drop into live collaboration workshops or schedule your own. Post collaboration requests, develop a creative community, and make real art." },
      { property: "og:title", content: "Workshop — Find people. Make things. Create a Portfolio." },
      { property: "og:description", content: "Drop into live collaboration workshops or schedule your own. Post collaboration requests, develop a creative community, and make real art." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Workshop — Find people. Make things. Create a Portfolio." },
      { name: "twitter:description", content: "Drop into live collaboration workshops or schedule your own. Post collaboration requests, develop a creative community, and make real art." },
      { property: "og:site_name", content: "Workshop" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&display=swap" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              name: "Workshop",
              url: "https://workshopindie.com",
              logo: "https://workshopindie.com/favicon.png",
              sameAs: ["https://www.instagram.com/workshopindie"],
            },
            {
              "@type": "WebSite",
              name: "Workshop",
              url: "https://workshopindie.com",
              potentialAction: {
                "@type": "SearchAction",
                target: "https://workshopindie.com/gallery?q={search_term_string}",
                "query-input": "required name=search_term_string",
              },
            },
          ],
        }),
      },
    ],

  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="min-h-screen bg-background pb-28 md:pb-0">
          <PaymentTestModeBanner />
          <MobileBrandHeader />
          <TopNav />
          <Outlet />
          <MobileNav />
          <WelcomeTour />
          <FirstRunHint />
          <WorkshopLiveToast />
          <RefCapture />
          <PendingRsvpFlush />
          <PresenceHeartbeat />
          <SignOutCacheReset />
          <TitleBadge />
          <AgeGate />




        </div>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

function PendingRsvpFlush() {
  usePendingRsvpFlush();
  return null;
}

function TitleBadge() {
  useTitleBadge();
  return null;
}

/**
 * Clear React Query cache on sign-out so a second user on the same browser
 * doesn't briefly see the previous user's DMs / notifications / me-page data.
 */
function SignOutCacheReset() {
  const qc = useQueryClient();
  const router = useRouter();
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_OUT") {
        await qc.cancelQueries();
        qc.clear();
        return;
      }
      // Flush pending group seed-link join after OAuth round-trip or email confirm.
      if (event === "SIGNED_IN" && typeof window !== "undefined") {
        const raw = sessionStorage.getItem("ws.pendingGroupJoin");
        if (!raw) return;
        let parsed: { token?: string; slug?: string } | null = null;
        try { parsed = JSON.parse(raw); } catch { parsed = null; }
        if (!parsed?.token || !parsed?.slug) {
          sessionStorage.removeItem("ws.pendingGroupJoin");
          return;
        }
        sessionStorage.removeItem("ws.pendingGroupJoin");
        try {
          const { redeemGroupSeedLink } = await import("@/lib/group-seed-links.functions");
          await redeemGroupSeedLink({ data: { token: parsed.token } });
          qc.invalidateQueries({ queryKey: ["my-group-ids"] });
          router.navigate({ to: "/g/$slug", params: { slug: parsed.slug } });
        } catch { /* swallow */ }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [qc, router]);
  return null;
}

