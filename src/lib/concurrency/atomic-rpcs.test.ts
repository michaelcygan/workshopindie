/**
 * Concurrency probes for the atomic RPCs introduced in Wave 4.
 *
 * These tests hit a REAL database — they are the only way to prove that two
 * simultaneous callers cannot both win a capacity race. They are therefore
 * opt-in and skipped by default, so CI and local `bun run test` stay hermetic.
 *
 * To run them:
 *
 *   RUN_CONCURRENCY_TESTS=1 \
 *   SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   bunx vitest run src/lib/concurrency
 *
 * The service role key is used only to fabricate and tear down throwaway
 * fixtures (users, an event, a room). The RPCs themselves are always invoked
 * through per-user clients carrying real access tokens, so RLS and `auth.uid()`
 * behave exactly as they do in the app.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const ENABLED =
  process.env["RUN_CONCURRENCY_TESTS"] === "1" &&
  !!process.env["SUPABASE_URL"] &&
  !!process.env["SUPABASE_SERVICE_ROLE_KEY"];

const d = ENABLED ? describe : describe.skip;

/** Number of callers racing for the same slot. */
const RACERS = 8;

type Actor = { id: string; email: string; client: SupabaseClient };

function admin(): SupabaseClient {
  return createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Creates a confirmed user and returns a client already signed in as them.
 * Passwords are random and never reused; the user is deleted in teardown.
 */
async function makeActor(sb: SupabaseClient, tag: string): Promise<Actor> {
  const email = `concurrency+${tag}-${crypto.randomUUID()}@workshop.test`;
  const password = crypto.randomUUID();
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);

  const client = createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const signIn = await client.auth.signInWithPassword({ email, password });
  if (signIn.error) throw new Error(`signIn failed: ${signIn.error.message}`);

  return { id: data.user.id, email, client };
}

d("atomic RPCs under concurrency", () => {
  const sb = ENABLED ? admin() : (null as unknown as SupabaseClient);
  let actors: Actor[] = [];
  let groupId = "";
  let eventId = "";
  let roomId = "";

  beforeAll(async () => {
    actors = await Promise.all(
      Array.from({ length: RACERS }, (_, i) => makeActor(sb, `a${i}`)),
    );

    const group = await sb
      .from("groups")
      .insert({
        name: `Concurrency Fixture ${crypto.randomUUID().slice(0, 8)}`,
        slug: `concurrency-${crypto.randomUUID().slice(0, 8)}`,
        kind: "micro",
        visibility: "unlisted",
        created_by: actors[0]!.id,
      })
      .select("id")
      .single();
    if (group.error) throw new Error(group.error.message);
    groupId = group.data.id;

    // Capacity 1, no waitlist: exactly one racer may end up 'going'.
    const event = await sb
      .from("group_events")
      .insert({
        group_id: groupId,
        created_by: actors[0]!.id,
        title: "Capacity race",
        slug: `capacity-race-${crypto.randomUUID().slice(0, 8)}`,
        status: "scheduled",
        visibility: "public",
        capacity: 1,
        waitlist_enabled: false,
        starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      })
      .select("id")
      .single();
    if (event.error) throw new Error(event.error.message);
    eventId = event.data.id;

    const room = await sb
      .from("instant_rooms")
      .insert({
        title: "Slot race",
        created_by: actors[0]!.id,
        status: "active",
        participant_cap: 2,
      })
      .select("id")
      .single();
    if (room.error) throw new Error(room.error.message);
    roomId = room.data.id;
  }, 60_000);

  afterAll(async () => {
    if (!ENABLED) return;
    if (roomId) await sb.from("instant_rooms").delete().eq("id", roomId);
    if (eventId) await sb.from("group_events").delete().eq("id", eventId);
    if (groupId) await sb.from("groups").delete().eq("id", groupId);
    await Promise.all(actors.map((a) => sb.auth.admin.deleteUser(a.id)));
  }, 60_000);

  it("reserve_event_rsvp never oversells a capacity-1 event", async () => {
    const results = await Promise.all(
      actors.map((a) =>
        a.client.rpc("reserve_event_rsvp", {
          _event_id: eventId,
          _status: "going",
          _plus_ones: 0,
          _note: null,
        }),
      ),
    );

    const outcomes = results.map((r) => r.data as string | null);
    expect(outcomes.filter((o) => o === "going")).toHaveLength(1);
    expect(outcomes.filter((o) => o === "full")).toHaveLength(RACERS - 1);

    // The table itself must agree with what the RPC reported.
    const { count } = await sb
      .from("group_event_rsvps")
      .select("user_id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .in("status", ["going", "maybe"]);
    expect(count).toBe(1);
  }, 60_000);

  it("reserve_event_rsvp is idempotent for a repeated identical call", async () => {
    const actor = actors[0]!;
    const first = await actor.client.rpc("reserve_event_rsvp", {
      _event_id: eventId,
      _status: "going",
      _plus_ones: 0,
      _note: null,
    });
    const second = await actor.client.rpc("reserve_event_rsvp", {
      _event_id: eventId,
      _status: "going",
      _plus_ones: 0,
      _note: null,
    });
    // A holder re-confirming must not be told the event is full, and must not
    // create a second row.
    expect(second.data).toBe(first.data);

    const { count } = await sb
      .from("group_event_rsvps")
      .select("user_id", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("user_id", actor.id);
    expect(count).toBe(1);
  }, 60_000);

  it("claim_lounge_slot respects participant_cap under a simultaneous rush", async () => {
    const results = await Promise.all(
      actors.map((a) =>
        a.client.rpc("claim_lounge_slot", {
          _room_id: roomId,
          _user_id: a.id,
          _cap: 2,
        }),
      ),
    );

    const statuses = results.map(
      (r) => (r.data as { status?: string } | null)?.status ?? "error",
    );
    expect(statuses.filter((s) => s === "joined")).toHaveLength(2);
    expect(statuses.filter((s) => s === "full")).toHaveLength(RACERS - 2);

    const { count } = await sb
      .from("instant_presence")
      .select("user_id", { count: "exact", head: true })
      .eq("room_id", roomId);
    expect(count).toBe(2);
  }, 60_000);

  it("get_or_create_conversation collapses a simultaneous double-open to one thread", async () => {
    const [a, b] = [actors[0]!, actors[1]!];
    // Both people press "Message" at the same instant, from both directions.
    const results = await Promise.all([
      a.client.rpc("get_or_create_conversation", {
        _other: b.id,
        _context_collab_post_id: null,
        _context_workshop_id: null,
        _context_work_id: null,
        _context_comment_id: null,
      }),
      b.client.rpc("get_or_create_conversation", {
        _other: a.id,
        _context_collab_post_id: null,
        _context_workshop_id: null,
        _context_work_id: null,
        _context_comment_id: null,
      }),
    ]);

    const ids = results.map((r) => r.data as string | null);
    expect(ids[0]).toBeTruthy();
    expect(ids[0]).toBe(ids[1]);

    const { count } = await sb
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .or(
        `and(user_a.eq.${a.id},user_b.eq.${b.id}),and(user_a.eq.${b.id},user_b.eq.${a.id})`,
      );
    expect(count).toBe(1);
  }, 60_000);
});
