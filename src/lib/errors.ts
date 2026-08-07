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
