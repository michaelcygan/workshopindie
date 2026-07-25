import { useMemo, useState, Fragment } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { BlogLightbox, type LightboxImage } from "./blog-lightbox";
import { BlogEmbed } from "./blog-embed";

type Props = { markdown: string; className?: string };

const EMBED_LINE = /^[ \t]*\[\[embed:(\S+?)\]\][ \t]*$/;

type Segment = { type: "md"; text: string } | { type: "embed"; url: string };

function splitEmbeds(md: string): Segment[] {
  const lines = md.split("\n");
  const out: Segment[] = [];
  let buf: string[] = [];
  const flush = () => {
    if (buf.length) {
      out.push({ type: "md", text: buf.join("\n") });
      buf = [];
    }
  };
  for (const line of lines) {
    const m = line.match(EMBED_LINE);
    if (m) {
      flush();
      out.push({ type: "embed", url: m[1] });
    } else {
      buf.push(line);
    }
  }
  flush();
  return out;
}

/**
 * Shared editorial Markdown renderer. Used by both /admin/blog preview and
 * the public /blog/$slug page so preview == public.
 *
 * - No raw HTML (no rehype-raw).
 * - Demotes any H1 in the body to H2 so pages keep a single semantic H1.
 * - External links get rel="noopener noreferrer" + target="_blank".
 * - Images lazy-load and open in a lightbox / slideshow on click.
 * - Recognizes full-line [[embed:URL]] markers and renders them via <BlogEmbed>.
 */
export function BlogPostBody({ markdown, className }: Props) {
  const images = useMemo<LightboxImage[]>(() => {
    const out: LightboxImage[] = [];
    const seen = new Set<string>();
    const re = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(markdown || "")) !== null) {
      const src = m[2];
      if (seen.has(src)) continue;
      seen.add(src);
      out.push({ src, alt: m[1] ?? "" });
    }
    return out;
  }, [markdown]);

  const indexBySrc = useMemo(() => {
    const map = new Map<string, number>();
    images.forEach((img, i) => map.set(img.src, i));
    return map;
  }, [images]);

  const segments = useMemo(() => splitEmbeds(markdown || ""), [markdown]);

  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const mdComponents = {
    h1: (props: any) => <h2 className="mt-10 mb-4 font-display text-2xl text-ink" {...props} />,
    h2: (props: any) => <h2 className="mt-10 mb-4 font-display text-2xl text-ink" {...props} />,
    h3: (props: any) => <h3 className="mt-8 mb-3 font-display text-xl text-ink" {...props} />,
    h4: (props: any) => <h4 className="mt-6 mb-2 font-display text-lg text-ink" {...props} />,
    p: (props: any) => <p className="my-5 text-[17px] leading-[1.75] text-ink-soft" {...props} />,
    a: ({ href, children, ...rest }: any) => {
      const external = !!href && /^https?:\/\//i.test(href);
      return (
        <a
          href={href}
          className="text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
          {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
          {...rest}
        >
          {children}
        </a>
      );
    },
    blockquote: (props: any) => (
      <blockquote
        className="my-6 border-l-4 border-primary/50 pl-4 italic text-ink-soft"
        {...props}
      />
    ),
    ul: (props: any) => <ul className="my-5 list-disc space-y-2 pl-6 text-[17px] text-ink-soft" {...props} />,
    ol: (props: any) => <ol className="my-5 list-decimal space-y-2 pl-6 text-[17px] text-ink-soft" {...props} />,
    li: (props: any) => <li className="leading-[1.7]" {...props} />,
    code: ({ className, children, ...rest }: any) => {
      const isBlock = /language-/.test(className ?? "");
      if (isBlock) {
        return (
          <code className={cn("block whitespace-pre", className)} {...rest}>
            {children}
          </code>
        );
      }
      return (
        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em] text-ink" {...rest}>
          {children}
        </code>
      );
    },
    pre: (props: any) => (
      <pre className="my-6 overflow-x-auto rounded-2xl bg-muted p-4 text-sm text-ink" {...props} />
    ),
    hr: () => <hr className="my-10 border-border" />,
    img: ({ src, alt }: any) => {
      const url = src ?? "";
      const i = indexBySrc.get(url) ?? 0;
      return (
        <button
          type="button"
          onClick={() => {
            setIndex(i);
            setOpen(true);
          }}
          className="my-6 block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-border transition hover:ring-2 hover:ring-primary/40"
          aria-label={alt ? `Open image: ${alt}` : "Open image"}
        >
          <img src={url} alt={alt ?? ""} loading="lazy" className="block w-full" />
        </button>
      );
    },
    table: (props: any) => (
      <div className="my-6 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full border-collapse text-sm" {...props} />
      </div>
    ),
    th: (props: any) => <th className="border-b border-border bg-muted px-3 py-2 text-left font-medium text-ink" {...props} />,
    td: (props: any) => <td className="border-b border-border/60 px-3 py-2 text-ink-soft" {...props} />,
  } as const;

  return (
    <>
      <div className={cn("blog-prose", className)}>
        {segments.map((seg, i) =>
          seg.type === "embed" ? (
            <BlogEmbed key={`e-${i}`} url={seg.url} />
          ) : (
            <Fragment key={`m-${i}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents as any}>
                {seg.text}
              </ReactMarkdown>
            </Fragment>
          ),
        )}
      </div>
      <BlogLightbox
        images={images}
        index={index}
        open={open}
        onClose={() => setOpen(false)}
        onIndexChange={setIndex}
      />
    </>
  );
}
