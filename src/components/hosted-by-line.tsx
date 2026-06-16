import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function HostedByLine({ hostUserId }: { hostUserId: string | null }) {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["host-profile", hostUserId],
    enabled: !!hostUserId,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, username, avatar_url")
        .eq("id", hostUserId!)
        .maybeSingle();
      return data as { display_name: string | null; username: string | null; avatar_url: string | null } | null;
    },
  });

  if (!hostUserId) return null;

  // Self case: the "Hosting" crown pill already lives in the header — skip the line.
  if (user && user.id === hostUserId) return null;

  const name = data?.display_name || data?.username || "Host";
  const username = data?.username;

  const content = (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
      <Crown className="h-3 w-3 text-violet" />
      Hosted by
      <span className="inline-flex items-center gap-1 text-ink">
        {data?.avatar_url ? (
          <img
            src={data.avatar_url}
            alt=""
            className="h-4 w-4 rounded-full object-cover"
          />
        ) : (
          <span className="h-4 w-4 rounded-full bg-muted" aria-hidden />
        )}
        {name}
      </span>
    </span>
  );

  if (username) {
    return (
      <Link to="/u/$username" params={{ username }} className="hover:underline">
        {content}
      </Link>
    );
  }
  return content;
}
