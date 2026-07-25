Make the Lounge stage speaking indicator less blinky by adding asymmetric hold in the voice-activity detector at `src/hooks/use-media-room.tsx` (`startSpeakingDetector`).

Changes, all local to that function:
- Use dual thresholds (hysteresis): turn ON at rms > ~0.05, only allow OFF when rms < ~0.03. This prevents flapping around a single threshold during normal speech dips.
- Track `lastVoiceAt` any time rms exceeds the ON threshold. Only flip `active` to false when the signal has been continuously below the OFF threshold for a sustained hold window (~700ms). Keep the fast turn-on (~120ms) so the halo appears responsively.
- Smooth rms with a short exponential moving average (~alpha 0.4) so single-frame dips between syllables don't drop below the OFF threshold.
- Broadcast the debounced `active` value on the same channel exactly as today; no signaling protocol change, no UI change.

Net effect: the halo fades on quickly when someone starts talking and stays on smoothly through natural pauses in speech, only turning off after a real gap.