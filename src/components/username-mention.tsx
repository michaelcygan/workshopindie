import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ProfilePeek } from "@/components/profile-peek";

/**
 * Wraps a mention chip for a user who may not be in the current room.
 * Resolves the username to a user id (cached) and mounts the standard
 * ProfilePeek so any tagged user gets the same mini profile float-open
 * treatment. Falls back to a plain profile link if the handle doesn't
 * resolve to a real user.
 */
export function UsernameMention({
  handle,
  children,
}: {
  handle: string;
  children: ReactNode;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["mention-user-id", handle.toLowerCase()],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", handle)
        .maybeSingle();
      return data?.id ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) return <>{children}</>;
  if (!data) {
    return (
      <Link to="/u/$username" params={{ username: handle }}>
        {children}
      </Link>
    );
  }
  return <ProfilePeek userId={data}>{children}</ProfilePeek>;
}
