/**
 * Persistent live layer for a Group.
 *
 * Mounted above the Group tab switch so audio survives Today → Collabs → Work
 * → Links → Blog navigation. Children render outside the Stream provider on
 * purpose: only the dock needs the transport, so tab content never remounts
 * when audio connects or drops.
 */
import { createContext, useContext, type ReactNode } from "react";
import { LoungeAudioProvider } from "@/components/stream-lounge-provider";
import { GroupAudioDock } from "@/components/group/group-audio-dock";
import {
  useGroupAudioSession,
  type GroupAudioSession,
} from "@/hooks/use-group-audio-session";

const GroupLiveContext = createContext<GroupAudioSession | null>(null);

/** Group audio session for the surrounding Group route. Null outside the shell. */
export function useGroupLive(): GroupAudioSession | null {
  return useContext(GroupLiveContext);
}

export function GroupLiveShell({
  groupId,
  groupName,
  isMember,
  children,
}: {
  groupId: string;
  groupName: string;
  isMember: boolean;
  children: ReactNode;
}) {
  const session = useGroupAudioSession(groupId, { isMember });

  return (
    <GroupLiveContext.Provider value={session}>
      {children}
      {session.roomId ? (
        <LoungeAudioProvider roomId={session.roomId} participation="chat">
          <GroupAudioDock
            groupName={groupName}
            connectedCount={session.connectedCount}
            onLeave={session.leaveAudio}
          />
        </LoungeAudioProvider>
      ) : null}
    </GroupLiveContext.Provider>
  );
}
