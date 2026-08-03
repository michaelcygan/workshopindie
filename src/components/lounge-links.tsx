/**
 * Legacy standalone-Lounge links panel.
 *
 * Thin wrapper over the shared presentational list so the Group `Links` tab
 * and the legacy Lounge stay visually identical without sharing semantics.
 */
import { useCallback } from "react";
import type { ProfileLite } from "@/components/media-panel";
import {
  SharedLinksList,
  type SharedLinkMessage,
} from "@/components/shared-links-list";

export function LoungeLinks({
  messages,
  profileLookup,
  className,
}: {
  messages: SharedLinkMessage[];
  profileLookup: Map<string, ProfileLite>;
  className?: string;
}) {
  const resolveSenderName = useCallback(
    (userId: string) => {
      const prof = profileLookup.get(userId);
      return prof?.display_name || prof?.username || "Someone";
    },
    [profileLookup],
  );

  return (
    <SharedLinksList
      messages={messages}
      resolveSenderName={resolveSenderName}
      emptyHint="Paste a link in chat and it'll show up here for everyone in the Lounge."
      className={`p-3 md:p-4 ${className ?? ""}`}
    />
  );
}
