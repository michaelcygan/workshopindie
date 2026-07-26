/**
 * Provider-neutral hook for consuming Lounge audio state.
 *
 * The concrete implementation (mesh or Stream) is chosen by
 * `<LoungeAudioProvider>` at mount time — never per hook call — so hook
 * order stays stable across renders and providers.
 */
import { createContext, useContext } from "react";
import type { LoungeAudioApi } from "@/lib/lounge-audio-types";

export const LoungeAudioContext = createContext<LoungeAudioApi | null>(null);

/**
 * Returns the current `LoungeAudioApi`. Throws when called outside a
 * `<LoungeAudioProvider>` boundary so callers can rely on a non-null value.
 */
export function useLoungeAudio(): LoungeAudioApi {
  const value = useContext(LoungeAudioContext);
  if (!value) {
    throw new Error(
      "useLoungeAudio must be used inside <LoungeAudioProvider>",
    );
  }
  return value;
}

/** Non-throwing variant for UI that renders both inside and outside the provider. */
export function useOptionalLoungeAudio(): LoungeAudioApi | null {
  return useContext(LoungeAudioContext);
}
