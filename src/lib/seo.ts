import { useEffect } from "react";

const BRAND = "Workshop";

function setMeta(name: string, value: string, attr: "name" | "property" = "name") {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

export function useDocumentMeta(opts: {
  title?: string;
  description?: string;
  image?: string | null;
  type?: "website" | "article" | "profile";
}) {
  const { title, description, image, type = "website" } = opts;
  useEffect(() => {
    if (!title && !description) return;
    const fullTitle = title ? `${title} — ${BRAND}` : BRAND;
    if (title) document.title = fullTitle;
    if (description) setMeta("description", description);
    setMeta("og:title", fullTitle, "property");
    if (description) setMeta("og:description", description, "property");
    setMeta("og:type", type, "property");
    if (image) {
      setMeta("og:image", image, "property");
      setMeta("twitter:image", image);
    }
    setMeta("twitter:card", image ? "summary_large_image" : "summary");
  }, [title, description, image, type]);
}

export function useJsonLd(data: object | null) {
  useEffect(() => {
    if (!data || typeof document === "undefined") return;
    const tag = document.createElement("script");
    tag.type = "application/ld+json";
    tag.text = JSON.stringify(data);
    tag.dataset.lovableLd = "1";
    document.head.appendChild(tag);
    return () => { tag.remove(); };
  }, [data]);
}
