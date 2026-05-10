import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function useUserRoles() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (!user) { setRoles([]); setLoading(false); return; }
    setLoading(true);
    supabase.from("user_roles").select("role").eq("user_id", user.id).then(({ data }) => {
      if (!alive) return;
      setRoles((data ?? []).map((r: any) => r.role));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [user?.id]);

  return { roles, isAdmin: roles.includes("admin"), loading };
}
