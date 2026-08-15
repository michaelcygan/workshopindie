/**
 * Centralized Blog column sets.
 *
 * Every list, card rail, detail read, and editor query selects taxonomy through
 * these constants so no surface can quietly read a smaller slice of the Blog
 * classification model than the shared resolver expects.
 *
 * They are `as const` literals (not joined arrays) because the Supabase client
 * infers row types from the literal select string.
 */

/** Post type, Fields, Subjects, and the legacy routing mirror. */
export const BLOG_TAXONOMY_COLUMNS = "category_slug,fields,subjects,story_type,story_types" as const;

/** Public list/rail rows — anything that renders a Blog card. */
export const BLOG_CARD_COLUMNS =
  `id,title,slug,excerpt,cover_image_url,cover_image_alt,author_name,published_at,updated_at,featured,publication_type,${BLOG_TAXONOMY_COLUMNS}` as const;

/** Compact rows for profile/entity rails where byline chrome is lighter. */
export const BLOG_RAIL_COLUMNS =
  `id,title,slug,excerpt,cover_image_url,cover_image_alt,author_name,published_at,${BLOG_TAXONOMY_COLUMNS}` as const;

/** Card rows joined to their author profile. */
export const BLOG_CARD_COLUMNS_WITH_AUTHOR =
  `${BLOG_CARD_COLUMNS},author_profile:profiles!blog_posts_author_profile_id_fkey(username,display_name,avatar_url)` as const;
