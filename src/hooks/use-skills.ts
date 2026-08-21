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
import type { EligibleWork, Skill, SkillWork } from "@/lib/skills/types";

const WORK = "id,slug,title,cover_url,category,category_canonical,subtype,status,visibility";
const SELECT = `id,position,label,description,work_id,links:profile_skill_works(position,work:works(${WORK}))`;

export function skillsQueryKey(profileId: string | undefined) {
  return ["profile-skills", profileId ?? "none"] as const;
}

type JoinedWork = SkillWork & { status?: string; visibility?: string };
type Row = {
  id: string;
  position: number;
  label: string;
  description: string | null;
  work_id: string | null;
  links: { position: number; work: JoinedWork | null }[] | null;
};

function toSkill(row: Row): Skill {
  const links = [...(row.links ?? [])].sort((a, b) => a.position - b.position);
  const works: SkillWork[] = [];
  let missing = 0;
  for (const link of links) {
    const w = link.work;
    if (w && w.status === "published" && w.visibility === "public") {
      const { status: _s, visibility: _v, ...rest } = w;
      works.push(rest);
    } else {
      missing += 1;
    }
  }
  return {
    id: row.id,
    position: row.position,
    label: row.label,
    description: row.description ?? null,
    work_id: row.work_id,
    works,
    missing_count: missing,
    work: works[0] ?? null,
  };
}

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
      return ((data ?? []) as unknown as Row[]).map(toSkill);
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
