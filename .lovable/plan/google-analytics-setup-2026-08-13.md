# Google Analytics Setup

## Goal
Connect Google Analytics 4 to Workshop so page views and key conversion events are tracked, while keeping the existing first-party traffic measurement intact.

## What you need to do
1. Have your GA4 **Measurement ID** (G-XXXXXXXXXX) ready from the Google Tag you created.
2. Approve the plan so I can connect the Google Analytics connector in Lovable. This will create the project env var `VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY` and keep your measurement ID out of the code.

## Technical implementation
1. **Connect the Lovable Google Analytics connector**
   - Use the standard connector `google_analytics`.
   - After connection, the measurement ID is injected as `VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY`.

2. **Create a lightweight analytics init module**
   - Add `src/lib/analytics/google.ts`.
   - It injects the gtag.js script once, initializes `window.dataLayer`, and calls `gtag('config', measurementId)`.
   - It reads `import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_ANALYTICS_API_KEY` and gracefully does nothing if the env var is missing.

3. **Wire up the app entry point**
   - Initialize Google Analytics from `src/routes/__root.tsx` after the app mounts (so the script is only injected client-side).

4. **Track SPA route changes**
   - TanStack Router handles navigation client-side, so GA does not automatically see page changes.
   - Add a `GoogleAnalyticsTracker` component that listens to `useRouterState` path changes and sends a `page_view` event with `page_path` and `page_title`.
   - Mount it alongside the existing `TrafficTracker` in `RootComponent`.

5. **Track key conversion events**
   - Add helper `gtagEvent(name, params)` in `src/lib/analytics/google.ts`.
   - Send the following events on existing actions:
     - `sign_up` when email/OAuth signup completes.
     - `begin_checkout` / `purchase` if/when Plus checkout completes (or reuse existing Stripe data).
     - `submit_application` for podcast applications.
     - `share` for public share/copy-link actions.
   - Keep event names GA4-convention-friendly.

6. **Respect existing privacy posture**
   - No IP, no user ID, no PII in event parameters.
   - The custom first-party `TrafficTracker` and `admin/traffic` dashboard remain untouched.

## Verification
- After publishing, confirm the GA4 realtime dashboard shows page views for the production domain.
- Check the browser console for any gtag errors or missing env var warnings.

## Out of scope for this plan
- Server-side Measurement Protocol calls or Google Analytics Data API queries.
- Replacing the existing first-party traffic analytics dashboard.
