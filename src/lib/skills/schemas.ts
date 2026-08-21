import { z } from "zod";
import {
  MAX_SKILLS,
  MAX_SKILL_WORKS,
  SKILL_DESCRIPTION_MAX,
  SKILL_LABEL_MAX,
  cleanSkillDescription,
  cleanSkillLabel,
} from "@/lib/skills/normalize";

const labelSchema = z
  .string()
  .transform(cleanSkillLabel)
  .refine((v) => v.length > 0, "Add a skill name.")
  .refine((v) => v.length <= SKILL_LABEL_MAX, `Keep it under ${SKILL_LABEL_MAX} characters.`);

const descriptionSchema = z
  .string()
  .nullish()
  .transform((v) => cleanSkillDescription(v))
  .refine(
    (v) => v === null || v.length <= SKILL_DESCRIPTION_MAX,
    `Keep the description under ${SKILL_DESCRIPTION_MAX} characters.`,
  );

const workIdsSchema = z
  .array(z.string().uuid())
  .min(1, "Choose at least one Work that demonstrates this skill.")
  .max(MAX_SKILL_WORKS, `Link at most ${MAX_SKILL_WORKS} works.`)
  .transform((ids) => [...new Set(ids)]);

export const addSkillSchema = z.object({
  label: labelSchema,
  description: descriptionSchema,
  work_ids: workIdsSchema,
});

export const updateSkillSchema = z.object({
  id: z.string().uuid(),
  label: labelSchema.optional(),
  description: descriptionSchema,
  work_ids: workIdsSchema.optional(),
});

export const removeSkillSchema = z.object({ id: z.string().uuid() });

export const reorderSkillsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(MAX_SKILLS),
});

export type AddSkillInput = z.infer<typeof addSkillSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;
