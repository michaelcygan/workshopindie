import { z } from "zod";
import { MAX_SKILLS, SKILL_LABEL_MAX, cleanSkillLabel } from "@/lib/skills/normalize";

const labelSchema = z
  .string()
  .transform(cleanSkillLabel)
  .refine((v) => v.length > 0, "Add a skill name.")
  .refine((v) => v.length <= SKILL_LABEL_MAX, `Keep it under ${SKILL_LABEL_MAX} characters.`);

export const addSkillSchema = z.object({
  label: labelSchema,
  work_id: z.string().uuid("Choose a Work that demonstrates this skill."),
});

export const updateSkillSchema = z.object({
  id: z.string().uuid(),
  label: labelSchema.optional(),
  work_id: z.string().uuid().optional(),
});

export const removeSkillSchema = z.object({ id: z.string().uuid() });

export const reorderSkillsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(MAX_SKILLS),
});

export type AddSkillInput = z.infer<typeof addSkillSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;
