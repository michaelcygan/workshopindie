import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Tiny CC chip + popover for the room meta row.
 * Ambient signal: anything riffed in a Workshop is CC BY-SA 4.0 until it
 * becomes a Collab, where the co-creators set their own terms.
 */
export function LicenseChip() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-surface px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-ink-muted hover:text-ink hover:border-border-strong transition"
          aria-label="Lounge license"
          title="Shared under CC BY-SA 4.0 until it becomes a Collab"
        >
          <span aria-hidden className="font-semibold">CC</span>
          <span>BY-SA</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-2xl border-border/70 p-4 shadow-lift">
        <div className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Workshop rights</div>
        <h4 className="mt-0.5 font-display text-base text-ink">Creative Commons by default</h4>
        <p className="mt-2 text-xs leading-relaxed text-ink-soft">
          Anything shared in this Workshop — chat, links, sketches, notes — is shared under{" "}
          <span className="font-medium text-ink">CC BY-SA 4.0</span> until it&apos;s turned into a Collab.
          Then the co-creators set their own terms.
        </p>
        <a
          href="https://creativecommons.org/licenses/by-sa/4.0/"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-[11px] font-medium text-primary hover:underline"
        >
          What CC BY-SA means →
        </a>
      </PopoverContent>
    </Popover>
  );
}
