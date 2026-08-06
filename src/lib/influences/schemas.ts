import { z } from "zod";

export const MAX_INFLUENCES = 10;

export const addWorkInfluenceSchema = z.object({
  kind: z.literal("workshop_work"),
  work_id: z.string().uuid(),
});

export const addExternalInfluenceSchema = z.object({
  kind: z.literal("external"),
  url: z.string().trim().min(3).max(2000),
  title: z.string().trim().max(200).optional().nullable(),
  creator_name: z.string().trim().max(160).optional().nullable(),
  category: z.string().trim().max(40).optional().nullable(),
  thumbnail_url: z.string().trim().max(2000).optional().nullable(),
  provider: z.string().trim().max(40).optional().nullable(),
});

export const addInfluenceSchema = z.discriminatedUnion("kind", [
  addWorkInfluenceSchema,
  addExternalInfluenceSchema,
]);

export const updateInfluenceSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().max(200).nullable().optional(),
  creator_name: z.string().trim().max(160).nullable().optional(),
  category: z.string().trim().max(40).nullable().optional(),
  thumbnail_url: z.string().trim().max(2000).nullable().optional(),
});

export const removeInfluenceSchema = z.object({ id: z.string().uuid() });

export const reorderInfluencesSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(MAX_INFLUENCES),
});

export const resolveInfluenceUrlSchema = z.object({
  url: z.string().trim().min(3).max(2000),
});

export type AddInfluenceInput = z.infer<typeof addInfluenceSchema>;
export type ResolvedInfluenceMeta = {
  url: string;
  title: string | null;
  creator_name: string | null;
  category: string | null;
  thumbnail_url: string | null;
  provider: string;
};
