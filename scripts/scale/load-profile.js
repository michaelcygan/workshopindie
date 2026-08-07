/**
 * Workshop — load profile (k6)
 *
 * Four scenarios that mirror how the app is actually used, not synthetic
 * hammering of one endpoint. Anonymous browsing dominates by volume; the
 * signed-in and write paths are smaller but far more expensive per request.
 *
 *   BASE_URL=https://project--<id>-dev.lovable.app k6 run scripts/scale/load-profile.js
 *
 * Optional, to include signed-in scenarios:
 *   SUPABASE_ACCESS_TOKEN=<a real user's token>
 *
 * Never point this at production. The preview deployment shares the database,
 * so run it while the scratch corpus is in place, not against live rows.
 */
import http from "k6/http";
import { check, group, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE = __ENV.BASE_URL;
if (!BASE) throw new Error("BASE_URL is required");
if (/workshopindie\.com|(?<!-dev)\.lovable\.app/.test(BASE) && !__ENV.ALLOW_PROD) {
  throw new Error("Refusing to load-test what looks like production. Set ALLOW_PROD=1 to override.");
}
const TOKEN = __ENV.SUPABASE_ACCESS_TOKEN || "";

const anonBrowse = new Trend("t_anon_browse", true);
const memberHome = new Trend("t_member_home", true);
const eventRead = new Trend("t_event_read", true);

export const options = {
  scenarios: {
    // The bulk of launch traffic: crawlers, social referrals, curious visitors.
    anonymous_browse: {
      executor: "ramping-vus",
      exec: "anonymousBrowse",
      startVUs: 0,
      stages: [
        { duration: "2m", target: 100 },
        { duration: "5m", target: 400 },
        { duration: "3m", target: 400 },
        { duration: "1m", target: 0 },
      ],
    },
    // Signed-in home is the heaviest read in the app (multi-query fan-out).
    signed_in_home: {
      executor: "ramping-vus",
      exec: "signedInHome",
      startVUs: 0,
      stages: [
        { duration: "2m", target: 20 },
        { duration: "6m", target: 80 },
        { duration: "2m", target: 0 },
      ],
    },
    // Spiky by nature: an event opens and everyone RSVPs within a minute.
    rsvp_burst: {
      executor: "constant-arrival-rate",
      exec: "rsvpBurst",
      rate: 30,
      timeUnit: "1s",
      duration: "3m",
      preAllocatedVUs: 60,
      startTime: "5m",
    },
    event_pages: {
      executor: "constant-arrival-rate",
      exec: "eventPage",
      rate: 20,
      timeUnit: "1s",
      duration: "10m",
      preAllocatedVUs: 40,
    },
  },
  thresholds: {
    // These are the launch bar. If they fail, the instance or the query plans
    // are the problem — not the test.
    "http_req_failed": ["rate<0.01"],
    "t_anon_browse": ["p(95)<800"],
    "t_member_home": ["p(95)<1500"],
    "t_event_read": ["p(95)<1000"],
  },
};

function authHeaders() {
  return TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
}

export function anonymousBrowse() {
  group("anonymous", () => {
    const paths = ["/", "/blog", "/events", "/groups", "/gallery"];
    const path = paths[Math.floor(Math.random() * paths.length)];
    const res = http.get(`${BASE}${path}`, { tags: { path } });
    anonBrowse.add(res.timings.duration);
    check(res, { "anon 200": (r) => r.status === 200 });
  });
  sleep(Math.random() * 4 + 1);
}

export function signedInHome() {
  if (!TOKEN) return;
  const res = http.get(`${BASE}/`, { headers: authHeaders() });
  memberHome.add(res.timings.duration);
  check(res, { "home 200": (r) => r.status === 200 });
  sleep(Math.random() * 6 + 2);
}

export function eventPage() {
  const res = http.get(`${BASE}/events`);
  eventRead.add(res.timings.duration);
  check(res, { "events 200": (r) => r.status === 200 });
}

export function rsvpBurst() {
  if (!TOKEN) return;
  // Exercises reserve_event_rsvp under contention through the real stack.
  // EVENT_ID must be a scratch event; the RPC is idempotent per user.
  const eventId = __ENV.EVENT_ID;
  if (!eventId) return;
  const res = http.post(
    `${BASE}/api/public/health`,
    JSON.stringify({ event_id: eventId }),
    { headers: { ...authHeaders(), "Content-Type": "application/json" } },
  );
  check(res, { "rsvp accepted": (r) => r.status < 500 });
}
