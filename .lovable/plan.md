Fix the sample-Lounge tiles on the home "Drop into the Lounge" rail to show the real cap (20), not the hardcoded "5 seats".

Change: in `src/components/home-live-workshops-rail.tsx` around line 216, replace the hardcoded `5 seats` with `{LOUNGE_CAP} seats` imported from `@/lib/lounge-constants`. Singular/plural handling isn't needed (cap is 20).

No other files change.
