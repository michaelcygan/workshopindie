/**
 * Server-only Stream Video helpers.
 *
 * Never imported from client code. Every entry point reads process.env
 * inline (per TanStack Start execution model). The Node SDK is created
 * per-call — cheap, keeps the module free of top-level side effects.
 */
import { StreamClient } from "@stream-io/node-sdk";

const DEFAULT_CALL_TYPE = "audio_room";
/** Stream user tokens: 60 minutes. */
const TOKEN_TTL_SECONDS = 60 * 60;

function readEnv() {
  const apiKey = process.env.STREAM_API_KEY;
  const apiSecret = process.env.STREAM_API_SECRET;
  const callType = process.env.STREAM_LOUNGE_CALL_TYPE ?? DEFAULT_CALL_TYPE;
  if (!apiKey || !apiSecret) {
    throw new Error(
      "Stream is not configured. Set STREAM_API_KEY and STREAM_API_SECRET.",
    );
  }
  return { apiKey, apiSecret, callType };
}

function newClient(): { client: StreamClient; apiKey: string; callType: string } {
  const { apiKey, apiSecret, callType } = readEnv();
  return { client: new StreamClient(apiKey, apiSecret), apiKey, callType };
}

export type StreamLoungeIssueResult = {
  apiKey: string;
  token: string;
  callType: string;
  callId: string;
  user: {
    id: string;
    name: string;
    image: string | null;
  };
};

/**
 * Upsert the Stream user record, ensure the audio_room call exists, and
 * mint a short-lived token. Called by `getLoungeStreamToken`.
 */
export async function issueLoungeStreamToken(opts: {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  roomId: string;
}): Promise<StreamLoungeIssueResult> {
  const { client, apiKey, callType } = newClient();

  await client.upsertUsers([
    {
      id: opts.userId,
      name: opts.displayName,
      image: opts.avatarUrl ?? undefined,
      role: "user",
    },
  ]);

  const call = client.video.call(callType, opts.roomId);
  // `getOrCreate` is idempotent; we set no policy fields that require host
  // ownership so any Workshop user can be first-in.
  await call.getOrCreate({ data: { created_by_id: opts.userId } }).catch((e) => {
    // Race with a peer creating the call at the same instant is fine.
    const msg = e instanceof Error ? e.message : String(e);
    if (!/already exists/i.test(msg)) throw e;
  });

  const expSec = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const token = client.generateUserToken({
    user_id: opts.userId,
    validity_in_seconds: TOKEN_TTL_SECONDS,
    // Ensure `exp` is set even if the SDK skips it in some paths.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...(({ exp: expSec } as any) as Record<string, never>),
  });

  return {
    apiKey,
    token,
    callType,
    callId: opts.roomId,
    user: { id: opts.userId, name: opts.displayName, image: opts.avatarUrl },
  };
}

/**
 * Grant `send-audio` capability on a specific Lounge call for one user.
 * Called after the Supabase queue RPC has confirmed the seat.
 */
export async function grantLoungeSendAudio(opts: {
  roomId: string;
  userId: string;
}): Promise<void> {
  const { client, callType } = newClient();
  const call = client.video.call(callType, opts.roomId);
  await call.updateUserPermissions({
    user_id: opts.userId,
    grant_permissions: ["send-audio"],
  });
}

/**
 * Revoke `send-audio` capability. Called on leaveMic, mic-permission
 * failure, or moderator kick.
 */
export async function revokeLoungeSendAudio(opts: {
  roomId: string;
  userId: string;
}): Promise<void> {
  const { client, callType } = newClient();
  const call = client.video.call(callType, opts.roomId);
  await call.updateUserPermissions({
    user_id: opts.userId,
    revoke_permissions: ["send-audio"],
  });
}
