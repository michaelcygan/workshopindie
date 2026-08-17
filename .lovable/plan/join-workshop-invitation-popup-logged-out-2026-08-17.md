# Join Workshop invitation popup (logged out)

A tasteful, once-per-visitor prompt that invites logged-out readers to create a free account (with a Plus mention), triggered after the visitor has actually engaged — not on arrival.

## Behavior

Trigger for logged-out visitors only, when **either** of these happens first:
- 8 seconds on the page, or
- meaningful scroll (past ~50% of the viewport-height x 1.5, i.e. real reading depth)

Shown at most once per 7-day window. After the window expires, the visitor is treated as a "first visit" again.

Dismiss rules:
- Close / Escape / backdrop → snooze for 7 days
- "Maybe later" → same 7-day snooze
- Signup completed → never show again (account exists)

Suppressed on: auth surfaces (`/login`, `/signup`, `/forgot-password`, `/reset-password`, `/auth/*`, `/goodbye`, `/checkout/*`), chrome-free acquisition pages (`/start-a-collab`), and any page that already renders its own signup gate modal (so two modals never stack).

## Content

- Headline: "Join Workshop"
- One line of value copy anchored to what they were reading (generic fallback: read, publish, and find collaborators).
- Primary: create free account — Google / Apple / email, reusing the existing signup gate modal UI.
- Secondary line: "Plus removes the limits — $4.99/mo" linking to `/pricing`.
- Tertiary: "Maybe later" dismiss.

## Technical notes

- New `src/components/join-workshop-prompt.tsx`: client-only component mounted once in `src/routes/__root.tsx` next to the other global runners (inside the non-chrome-free tree). Reads `useAuth()`; renders nothing while auth is loading or when a user exists.
- New `src/lib/join-prompt-state.ts`: pure helpers for the 7-day window (`shouldShowJoinPrompt(now, stored)`, `snoozeUntil(now)`), persisted in `localStorage` under `ws.join_prompt_snooze_until`. Pure so it can be unit tested; storage access wrapped in try/catch (Safari private mode).
- Trigger logic in a small `useEngagementTrigger` hook inside the component: `setTimeout` 8s + a passive `scroll` listener, whichever fires first; both cleaned up on unmount.
- Reuses `SignupGateModal` for the actual auth UI, passing a Workshop-specific title/subtitle plus a new optional footer slot for the Plus line and "Maybe later". No duplicate auth logic.
- No new tables, no server functions, no backend changes.
- Unit test `src/lib/join-prompt-state.test.ts` covering: never-seen → show, within 7 days → hide, past 7 days → show again.
