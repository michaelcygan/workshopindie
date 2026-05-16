import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Compact number formatter — 12834 → "12.8k", 1_300_000 → "1.3M". */
export function formatCount(n: number | null | undefined): string {
  const v = n ?? 0;
  if (v < 1000) return String(v);
  if (v < 10_000) return (v / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  if (v < 1_000_000) return Math.round(v / 1000) + "k";
  return (v / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}
