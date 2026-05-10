import { supabase } from "@/integrations/supabase/client";

export async function uploadToBucket(bucket: "avatars" | "covers" | "work-covers", userId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
