import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type Props = { markdown: string; className?: string };

/**
 * Shared editorial Markdown renderer. Used by both /admin/blog preview and
 * the public /blog/$slug page so preview == public.
 *
 * - No raw HTML (no rehype-raw).
 * - Demotes any H1 in the body to H2 so pages keep a single semantic H1.
 * - External links get rel="noopener noreferrer" + target="_blank".
 * - Images lazy-load.
 */
export function BlogPostBody({ markdown, className }: Props) {
  return (
    <div className={cn("blog-prose", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: (props) => <h2 className="mt-10 mb-4 font-display text-2xl text-ink" {...props} />,
          h2: (props) => <h2 className="mt-10 mb-4 font-display text-2xl text-ink" {...props} />,
          h3: (props) => <h3 className="mt-8 mb-3 font-display text-xl text-ink" {...props} />,
          h4: (props) => <h4 className="mt-6 mb-2 font-display text-lg text-ink" {...props} />,
          p: (props) => <p className="my-5 text-[17px] leading-[1.75] text-ink-soft" {...props} />,
          a: ({ href, children, ...rest }) => {
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
          blockquote: (props) => (
            <blockquote
              className="my-6 border-l-4 border-primary/50 pl-4 italic text-ink-soft"
              {...props}
            />
          ),
          ul: (props) => <ul className="my-5 list-disc space-y-2 pl-6 text-[17px] text-ink-soft" {...props} />,
          ol: (props) => <ol className="my-5 list-decimal space-y-2 pl-6 text-[17px] text-ink-soft" {...props} />,
          li: (props) => <li className="leading-[1.7]" {...props} />,
          code: ({ className, children, ...rest }) => {
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
          pre: (props) => (
            <pre className="my-6 overflow-x-auto rounded-2xl bg-muted p-4 text-sm text-ink" {...props} />
          ),
          hr: () => <hr className="my-10 border-border" />,
          img: ({ src, alt }) => (
            <img
              src={src ?? ""}
              alt={alt ?? ""}
              loading="lazy"
              className="my-6 w-full rounded-2xl border border-border"
            />
          ),
          table: (props) => (
            <div className="my-6 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full border-collapse text-sm" {...props} />
            </div>
          ),
          th: (props) => <th className="border-b border-border bg-muted px-3 py-2 text-left font-medium text-ink" {...props} />,
          td: (props) => <td className="border-b border-border/60 px-3 py-2 text-ink-soft" {...props} />,
        }}
      >
        {markdown || ""}
      </ReactMarkdown>
    </div>
  );
}
