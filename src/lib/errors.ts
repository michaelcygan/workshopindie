/**
 * Canonical server-side domain errors.
 *
 * The point is observability and consistency, not new UI: every message here
 * is the string Workshop already showed for that situation, so screens behave
 * exactly as before while logs get a stable machine-readable code.
 */

export type DomainErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "ALREADY_EXISTS"
  | "FULL"
  | "CLOSED"
  | "RATE_LIMITED"
  | "MODERATION_BLOCKED"
  | "INVALID_INPUT"
  | "CONFLICT";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  constructor(code: DomainErrorCode, message: string) {
    super(message);
    this.name = "DomainError";
    this.code = code;
  }
}

export const domainError = (code: DomainErrorCode, message: string) =>
  new DomainError(code, message);

/**
 * Outcome strings returned by the atomic Postgres RPCs (Waves 4 and 5).
 *
 * The RPCs settle capacity, locks and membership inside one transaction and
 * report the reason as a short string. Mapping those strings to codes in one
 * place stops each new caller from inventing its own phrasing for "full".
 */
const RPC_OUTCOME_CODES: Record<string, DomainErrorCode> = {
  full: "FULL",
  closed: "CLOSED",
  locked: "CLOSED",
  forbidden: "FORBIDDEN",
  not_found: "NOT_FOUND",
  already_joined: "ALREADY_EXISTS",
  already_exists: "ALREADY_EXISTS",
  conflict: "CONFLICT",
  rate_limited: "RATE_LIMITED",
  invalid: "INVALID_INPUT",
};

/** Code for an RPC outcome string; unknown outcomes are treated as refusals. */
export function rpcOutcomeCode(outcome: string): DomainErrorCode {
  return RPC_OUTCOME_CODES[outcome] ?? "FORBIDDEN";
}

/**
 * Build the error for a refused RPC outcome, keeping the surface's own copy.
 * `message` is what the user already sees today; only the code is new.
 */
export function rpcOutcomeError(outcome: string, message: string): DomainError {
  return new DomainError(rpcOutcomeCode(outcome), message);
}
