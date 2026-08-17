import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  addSkill,
  listEligibleSkillWorks,
  removeSkill,
  reorderSkills,
  updateSkill,
} from "@/lib/skills.functions";
import type { AddSkillInput, UpdateSkillInput } from "@/lib/skills/schemas";
import type { EligibleWork, Skill } from "@/lib/skills/types";

const SELECT =
  "id,position,label,work_id,work:works(id,slug,title,cover_url,category,category_canonical,subtype,status,visibility)";

export function skillsQueryKey(profileId: string | undefined) {
  return ["profile-skills", profileId ?? "none"] as const;
}

type Row = Omit<Skill, "work"> & {
  work: (Skill["work"] & { status?: string; visibility?: string }) | null;
};

/** One query for a profile's whole skill shelf, with live Work data joined. */
export function useSkills(profileId: string | undefined) {
  return useQuery({
    queryKey: skillsQueryKey(profileId),
    enabled: !!profileId,
    staleTime: 30_000,
    queryFn: async (): Promise<Skill[]> => {
      const { data, error } = await supabase
        .from("profile_skills")
        .select(SELECT)
        .eq("profile_id", profileId!)
        .order("position", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as Row[]).map((row) => {
        const w = row.work;
        const live = w && w.status === "published" && w.visibility === "public";
        return { ...row, work: live ? w : null } as Skill;
      });
    },
  });
}

/** Works the signed-in member may attach as evidence. */
export function useEligibleSkillWorks(enabled: boolean) {
  const list = useServerFn(listEligibleSkillWorks);
  return useQuery({
    queryKey: ["skill-eligible-works"],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<EligibleWork[]> => list(),
  });
}

/** Owner-side mutations. Each persists on its own — no global Save required. */
export function useSkillMutations(profileId: string | undefined) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: skillsQueryKey(profileId) });
  };

  const add = useServerFn(addSkill);
  const update = useServerFn(updateSkill);
  const remove = useServerFn(removeSkill);
  const reorder = useServerFn(reorderSkills);

  return {
    add: useMutation({
      mutationFn: (input: AddSkillInput) => add({ data: input }),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: (input: UpdateSkillInput) => update({ data: input }),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => remove({ data: { id } }),
      onSuccess: invalidate,
    }),
    reorder: useMutation({
      mutationFn: (ids: string[]) => reorder({ data: { ids } }),
      onSuccess: invalidate,
    }),
  };
}
