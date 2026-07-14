import { MentionPopover } from "@/components/mention-popover";
import type { MentionSuggestion } from "@/lib/mention-suggestions";

/**
 * Today board `@` popover. Suggests: people (global), your collabs,
 * groups (yours first, then public), and upcoming events. Kept as a
 * thin wrapper around the shared MentionPopover so behavior stays in
 * sync with Lounge / DMs.
 *
 * `groupId` is no longer used to gate people to group members — we
 * broadened to global handle search for cross-group discoverability,
 * matching the rest of the app.
 */
interface Props {
  open: boolean;
  query: string;
  groupId: string;
  onPick: (insert: string) => void;
  onClose: () => void;
  anchorClassName?: string;
}

export function TodayMentionPopover({ open, query, onPick, onClose, anchorClassName }: Props) {
  return (
    <MentionPopover
      open={open}
      query={query}
      sections={["user", "collab", "group", "event", "work"]}
      onPick={(s: MentionSuggestion) => onPick(s.insert.trimEnd())}
      onClose={onClose}
      className={anchorClassName}
    />
  );
}
