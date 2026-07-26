// Thin compatibility re-export. The mobile navigation now lives in
// src/components/mobile-island/. Keep this file so existing imports
// (e.g. src/routes/__root.tsx) continue to work without churn.
export { MobileActionIsland as MobileNav } from "@/components/mobile-island";
