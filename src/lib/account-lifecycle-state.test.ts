import { describe, it, expect } from "vitest";
import { deriveLifecycleState, type LifecycleInput } from "./account-lifecycle-state";

const base: LifecycleInput = {
  isAuthenticated: true,
  authLoading: false,
  queryStatus: "success",
  facts: {
    hasBirthdate: true,
    welcomeCompleted: true,
    profileCompleted: true,
    profileExists: true,
  },
};

const facts = (over: Partial<NonNullable<LifecycleInput["facts"]>>) => ({
  ...base,
  facts: { ...base.facts!, ...over },
});

describe("deriveLifecycleState", () => {
  it("1. signed out → no dialog", () => {
    expect(
      deriveLifecycleState({ ...base, isAuthenticated: false, facts: null, queryStatus: "idle" }),
    ).toBe("signed_out");
  });

  it("2. authenticated, lookup loading → loading", () => {
    expect(deriveLifecycleState({ ...base, queryStatus: "loading", facts: null })).toBe("loading");
    expect(deriveLifecycleState({ ...base, authLoading: true })).toBe("loading");
  });

  it("3. no birthdate, onboarded false, no tour → age required", () => {
    expect(
      deriveLifecycleState(
        facts({ hasBirthdate: false, profileCompleted: false, welcomeCompleted: false }),
      ),
    ).toBe("age_required");
  });

  it("4. no birthdate, onboarded true, tour complete → age required", () => {
    expect(
      deriveLifecycleState(
        facts({ hasBirthdate: false, profileCompleted: true, welcomeCompleted: true }),
      ),
    ).toBe("age_required");
  });

  it("5. birthdate, onboarded false, no tour → welcome required", () => {
    expect(
      deriveLifecycleState(
        facts({ hasBirthdate: true, profileCompleted: false, welcomeCompleted: false }),
      ),
    ).toBe("welcome_required");
  });

  it("6. birthdate, onboarded true, no tour → welcome required", () => {
    expect(
      deriveLifecycleState(
        facts({ hasBirthdate: true, profileCompleted: true, welcomeCompleted: false }),
      ),
    ).toBe("welcome_required");
  });

  it("7. birthdate + tour, onboarded false → ready (profile stays incomplete)", () => {
    expect(deriveLifecycleState(facts({ profileCompleted: false }))).toBe("ready");
  });

  it("8. birthdate + tour + onboarded → ready", () => {
    expect(deriveLifecycleState(base)).toBe("ready");
  });

  it("9. lookup failure → retryable error, not ready", () => {
    expect(deriveLifecycleState({ ...base, queryStatus: "error", facts: null })).toBe("load_error");
  });

  it("10. missing profile row → error, never silently ready", () => {
    expect(deriveLifecycleState(facts({ profileExists: false }))).toBe("load_error");
  });

  it("underage submission wins over everything else", () => {
    expect(deriveLifecycleState({ ...base, underage: true })).toBe("underage_removal");
  });
});
