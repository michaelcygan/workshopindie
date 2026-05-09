import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function ComingSoon({
  title,
  blurb,
  ctaLabel = "Back to Gallery",
  to = "/" as const,
}: {
  title: string;
  blurb: string;
  ctaLabel?: string;
  to?: "/";
}) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-3xl border border-border bg-surface p-10 shadow-soft"
      >
        <span className="inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium text-ink-muted">
          Coming next
        </span>
        <h1 className="mt-4 font-display text-4xl text-ink">{title}</h1>
        <p className="mt-3 text-ink-soft">{blurb}</p>
        <Link to={to} className="mt-6 inline-block">
          <Button className="rounded-full">{ctaLabel}</Button>
        </Link>
      </motion.div>
    </div>
  );
}
