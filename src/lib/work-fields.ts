/**
 * Field/Format write + read helpers for the row shapes that still carry the
 * legacy `category` enum columns.
 *
 * Workshop's source of truth is the canonical Field (`*_canonical` columns).
 * `category` / `categories` are legacy NOT NULL enum columns kept in sync
 * through `fieldToLegacyEnum` so old rows, old queries and old filters keep
 * working. Database triggers only *fill* the canonical columns when the app
 * does not supply them, so what we write here is what is stored.
 */
import type { Database } from "@/integrations/supabase/types";
import { fieldToLegacyEnum, fieldsForStoredValues, normalizeField, type FieldId } from "@/lib/taxonomy";

type LegacyCategory = Database["public"]["Enums"]["category"];

export type FieldWritePayload = {
  category: LegacyCategory;
  categories: LegacyCategory[];
  category_canonical: FieldId;
  categories_canonical: FieldId[];
};

/** Normalize a picker selection into the columns a Work/Collab row expects. */
export function fieldWritePayload(primary: string, extras: readonly string[] = []): FieldWritePayload {
  const primaryField = normalizeField(primary);
  const fields: FieldId[] = [primaryField];
  for (const e of extras) {
    const f = normalizeField(e);
    if (!fields.includes(f)) fields.push(f);
  }
  const legacy: LegacyCategory[] = [];
  for (const f of fields) {
    const l = fieldToLegacyEnum(f) as LegacyCategory;
    if (!legacy.includes(l)) legacy.push(l);
  }
  return {
    category: fieldToLegacyEnum(primaryField) as LegacyCategory,
    categories: legacy,
    category_canonical: primaryField,
    categories_canonical: fields,
  };
}

type FieldRow = {
  category?: string | null;
  categories?: readonly (string | null)[] | null;
  category_canonical?: string | null;
  categories_canonical?: readonly (string | null)[] | null;
};

/** Every Field a row belongs to, primary first. Never empty. */
export function rowFields(row: FieldRow | null | undefined): FieldId[] {
  if (!row) return ["other"];
  const canonical = [row.category_canonical, ...(row.categories_canonical ?? [])];
  const legacy = [row.category, ...(row.categories ?? [])];
  const fields = fieldsForStoredValues(canonical, legacy);
  return fields.length > 0 ? fields : ["other"];
}

/** The single Field a row leads with — drives cover color and share cards. */
export function rowPrimaryField(row: FieldRow | null | undefined): FieldId {
  return rowFields(row)[0]!;
}

export type ProfileFieldWritePayload = {
  categories: LegacyCategory[];
  categories_canonical: FieldId[];
};

/**
 * Profiles carry Fields as broad disciplines (no single primary column).
 * `categories` stays populated with the legacy enum equivalents so old
 * profile queries and the medium-group triggers keep working.
 */
export function profileFieldWritePayload(fields: readonly string[]): ProfileFieldWritePayload {
  const canonical: FieldId[] = [];
  for (const f of fields) {
    const n = normalizeField(f);
    if (!canonical.includes(n)) canonical.push(n);
  }
  const legacy: LegacyCategory[] = [];
  for (const f of canonical) {
    const l = fieldToLegacyEnum(f) as LegacyCategory;
    if (!legacy.includes(l)) legacy.push(l);
  }
  return { categories: legacy, categories_canonical: canonical };
}

/** Fields a profile row claims. May be empty — profiles need not pick any. */
export function profileFields(row: FieldRow | null | undefined): FieldId[] {
  if (!row) return [];
  const canonical = (row.categories_canonical ?? []) as (string | null)[];
  const legacy = (row.categories ?? []) as (string | null)[];
  return fieldsForStoredValues(canonical, legacy);
}
