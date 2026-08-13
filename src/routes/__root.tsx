import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { TopNav } from "@/components/top-nav";
import { MobileBrandHeader } from "@/components/mobile-brand-header";
import { MobileNav } from "@/components/mobile-nav";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";

import { RefCapture } from "@/components/ref-capture";
import { TrackingClickAttribution } from "@/components/tracking-click-attribution";
import { PresenceHeartbeat } from "@/components/presence-heartbeat";
import { TrafficTracker } from "@/components/traffic-tracker";
import { GoogleAnalyticsTracker } from "@/components/google-analytics-tracker";

import { AccountLifecycleProvider } from "@/components/account-lifecycle/provider";
import { AccountLifecycleGate } from "@/components/account-lifecycle/gate";
import {
  PostAuthRunner,
  clearPendingAuthState,
} from "@/components/account-lifecycle/post-auth-runner";
import { useTitleBadge } from "@/hooks/use-title-badge";
import { RealtimeNotificationsProvider } from "@/hooks/use-realtime-notifications";
import { supabase } from "@/integrations/supabase/client";
import { SiteFooter } from "@/components/site-footer";
import { OAuthErrorToast } from "@/components/oauth-error-toast";

import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-7xl text-ink">404</h1>
        <h2 className="mt-4 text-xl text-ink">Lost in the studio</h2>
        <p className="mt-2 text-sm text-ink-muted">This page doesn't exist (yet).</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
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
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-full border border-border bg-surface px-5 py-2 text-sm font-medium text-ink hover:bg-muted"
          >
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
      {
        name: "description",
        content:
          "Drop into live collaboration workshops or schedule your own. Post collaboration requests, develop a creative community, and make real art.",
      },
      { property: "og:title", content: "Workshop — Find people. Make things. Create a Portfolio." },
      {
        property: "og:description",
        content:
          "Drop into live collaboration workshops or schedule your own. Post collaboration requests, develop a creative community, and make real art.",
      },
      { property: "og:type", content: "website" },
      // Sitewide default only — leaf routes override og:image with the
      // entity's own cover. No width/height/type here: those would leak onto
      // leaf pages whose cover has different dimensions.
      {
        property: "og:image",
        content: "https://workshopindie.com/brand/og-default.png",
      },
      { property: "og:image:secure_url", content: "https://workshopindie.com/brand/og-default.png" },
      { property: "og:image:alt", content: "Workshop — independent culture, happening now" },
      { property: "og:site_name", content: "Workshop" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        name: "twitter:title",
        content: "Workshop — Find people. Make things. Create a Portfolio.",
      },
      {
        name: "twitter:description",
        content:
          "Drop into live collaboration workshops or schedule your own. Post collaboration requests, develop a creative community, and make real art.",
      },
      {
        name: "twitter:image",
        content: "https://workshopindie.com/brand/og-default.png",
      },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Archivo:wght@400;500;600;700&display=swap",
      },
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
        <AccountLifecycleProvider>
          {/* One realtime channel per session, shared by the bell, the DM
              badge and the tab-title badge. See use-realtime-notifications. */}
          <RealtimeNotificationsProvider>
            <div className="min-h-screen bg-background pb-28 md:pb-0">
              <PaymentTestModeBanner />
              <MobileBrandHeader />
              <TopNav />
              <Outlet />
              <SiteFooter />
              <MobileNav />

              <OAuthErrorToast />

              <RefCapture />
              <TrackingClickAttribution />
              <PresenceHeartbeat />
              <TrafficTracker />
              <GoogleAnalyticsTracker />
              <SignOutCacheReset />

              <TitleBadge />
              <AccountLifecycleGate />
              <PostAuthRunner />
            </div>
          </RealtimeNotificationsProvider>
        </AccountLifecycleProvider>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
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
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "SIGNED_OUT") {
        await qc.cancelQueries();
        qc.clear();
        clearPendingAuthState();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [qc]);
  return null;
}
