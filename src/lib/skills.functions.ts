import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  addSkillSchema,
  removeSkillSchema,
  reorderSkillsSchema,
  updateSkillSchema,
} from "@/lib/skills/schemas";
import type { EligibleWork } from "@/lib/skills/types";

/** Works the signed-in member may use as Skill evidence (owned or visibly credited). */
export const listEligibleSkillWorks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EligibleWork[]> => {
    const { listEligibleWorks } = await import("@/lib/skills/skills.server");
    return listEligibleWorks(context.supabase, context.userId);
  });

export const addSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => addSkillSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { insertSkill } = await import("@/lib/skills/skills.server");
    return insertSkill(context.supabase, context.userId, data);
  });

export const updateSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateSkillSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { patchSkill } = await import("@/lib/skills/skills.server");
    return patchSkill(context.supabase, context.userId, data);
  });

export const removeSkill = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => removeSkillSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { deleteSkill } = await import("@/lib/skills/skills.server");
    return deleteSkill(context.supabase, context.userId, data.id);
  });

export const reorderSkills = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => reorderSkillsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { applySkillOrder } = await import("@/lib/skills/skills.server");
    return applySkillOrder(context.supabase, context.userId, data.ids);
  });
