import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PUBLIC_CACHE = "public, s-maxage=60, stale-while-revalidate=600";
const slug = z.string().trim().min(1).max(200);

export const getWorkSeo = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => ({ slug: slug.parse(d.slug) }))
  .handler(async ({ data }) => {
    setResponseHeader("cache-control", PUBLIC_CACHE);
    const { data: row } = await supabaseAdmin
      .from("works")
      .select("title,excerpt,description,cover_url,published_at")
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    return row ?? null;
  });

export const getProfileSeo = createServerFn({ method: "GET" })
  .inputValidator((d: { username: string }) => ({ username: slug.parse(d.username) }))
  .handler(async ({ data }) => {
    setResponseHeader("cache-control", PUBLIC_CACHE);
    const { data: row } = await supabaseAdmin
      .from("profiles")
      .select("display_name,username,headline,bio,avatar_url")
      .eq("username", data.username)
      .maybeSingle();
    return row ?? null;
  });

export const getWorkshopSeo = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => ({ slug: slug.parse(d.slug) }))
  .handler(async ({ data }) => {
    setResponseHeader("cache-control", PUBLIC_CACHE);
    const { data: row } = await supabaseAdmin
      .from("workshops")
      .select("title,prompt,category,starts_at")
      .eq("slug", data.slug)
      .maybeSingle();
    return row ?? null;
  });

export const getCitySeo = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => ({ slug: slug.parse(d.slug) }))
  .handler(async ({ data }) => {
    setResponseHeader("cache-control", PUBLIC_CACHE);
    const { data: row } = await supabaseAdmin
      .from("cities")
      .select("name,country")
      .eq("slug", data.slug)
      .maybeSingle();
    return row ?? null;
  });

export const getCollabSeo = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => ({ slug: slug.parse(d.slug) }))
  .handler(async ({ data }) => {
    setResponseHeader("cache-control", PUBLIC_CACHE);
    const { data: row } = await supabaseAdmin
      .from("collab_posts")
      .select("title,description,category,status,resulting_work_id")
      .eq("slug", data.slug)
      .maybeSingle();
    return row ?? null;
  });
