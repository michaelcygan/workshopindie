import { useState } from "react";
import { Plus, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

export type BookBuyLink = { label: string; url: string };

const PRESET_LABELS = [
  "Amazon",
  "Kindle",
  "Bookshop",
  "Goodreads",
  "Apple Books",
  "Author site",
  "Audiobook",
];

export type BookDetails = {
  author: string;
  buyLinks: BookBuyLink[];
  excerptUrl: string;
  publisher: string;
  isbn: string;
  publishedOn: string;
  pageCount: string;
};

export const emptyBookDetails: BookDetails = {
  author: "",
  buyLinks: [{ label: "Amazon", url: "" }],
  excerptUrl: "",
  publisher: "",
  isbn: "",
  publishedOn: "",
  pageCount: "",
};

export function BookDetailsSection({
  value,
  onChange,
}: {
  value: BookDetails;
  onChange: (v: BookDetails) => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  function patch(p: Partial<BookDetails>) {
    onChange({ ...value, ...p });
  }
  function patchLink(i: number, p: Partial<BookBuyLink>) {
    const next = value.buyLinks.slice();
    next[i] = { ...next[i], ...p };
    patch({ buyLinks: next });
  }
  function addLink() {
    const used = new Set(value.buyLinks.map((l) => l.label));
    const nextLabel = PRESET_LABELS.find((l) => !used.has(l)) ?? "Link";
    patch({ buyLinks: [...value.buyLinks, { label: nextLabel, url: "" }] });
  }
  function removeLink(i: number) {
    patch({ buyLinks: value.buyLinks.filter((_, idx) => idx !== i) });
  }

  return (
    <section className="space-y-5 rounded-2xl border border-cat-book-ink/20 bg-cat-book/40 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-cat-book-ink">
        <span className="text-base">📖</span>
        Book details
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="book-author">Author</Label>
        <Input
          id="book-author"
          value={value.author}
          onChange={(e) => patch({ author: e.target.value })}
          placeholder="Pen name, real name, or 'You & Co-author'"
          maxLength={140}
        />
        <p className="text-xs text-ink-muted">How you want it credited on the book page.</p>
      </div>

      <div className="space-y-2">
        <Label>Buy / read it</Label>
        <div className="space-y-2">
          {value.buyLinks.map((link, i) => (
            <div key={i} className="flex flex-wrap gap-2 sm:flex-nowrap">
              <select
                value={PRESET_LABELS.includes(link.label) ? link.label : "Custom"}
                onChange={(e) => {
                  const v = e.target.value;
                  patchLink(i, { label: v === "Custom" ? (link.label || "") : v });
                }}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm text-ink"
              >
                {PRESET_LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
                <option value="Custom">Custom…</option>
              </select>
              {!PRESET_LABELS.includes(link.label) && (
                <Input
                  value={link.label}
                  onChange={(e) => patchLink(i, { label: e.target.value })}
                  placeholder="Label"
                  className="sm:w-32"
                  maxLength={40}
                />
              )}
              <Input
                type="url"
                value={link.url}
                onChange={(e) => patchLink(i, { url: e.target.value })}
                placeholder="https://…"
                className="flex-1"
              />
              {value.buyLinks.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLink(i)}
                  className="shrink-0 text-ink-muted hover:text-destructive"
                  aria-label="Remove link"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addLink}
            className="gap-1.5 text-ink-muted hover:text-ink"
          >
            <Plus className="h-3.5 w-3.5" /> Add another place
          </Button>
        </div>
        <p className="text-xs text-ink-muted">
          The first link is the primary CTA on your book page. Self-published is fine — link to your store.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="book-excerpt">Sample chapter link <span className="text-ink-muted font-normal">(optional)</span></Label>
        <Input
          id="book-excerpt"
          type="url"
          value={value.excerptUrl}
          onChange={(e) => patch({ excerptUrl: e.target.value })}
          placeholder="Google Doc, Substack post, PDF on your site…"
        />
      </div>

      <button
        type="button"
        onClick={() => setAdvancedOpen((v) => !v)}
        className="flex w-full items-center justify-between text-xs text-ink-muted hover:text-ink"
      >
        <span>More book details</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", advancedOpen && "rotate-180")} />
      </button>
      <AnimatePresence initial={false}>
        {advancedOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 pt-1">
              <div className="space-y-1.5">
                <Label htmlFor="book-publisher" className="text-xs">Publisher</Label>
                <Input
                  id="book-publisher"
                  value={value.publisher}
                  onChange={(e) => patch({ publisher: e.target.value })}
                  placeholder="Self-published"
                  maxLength={120}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="book-published-on" className="text-xs">Release date</Label>
                <Input
                  id="book-published-on"
                  type="date"
                  value={value.publishedOn}
                  onChange={(e) => patch({ publishedOn: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="book-isbn" className="text-xs">ISBN</Label>
                <Input
                  id="book-isbn"
                  value={value.isbn}
                  onChange={(e) => patch({ isbn: e.target.value })}
                  placeholder="978-…"
                  maxLength={32}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="book-pages" className="text-xs">Pages</Label>
                <Input
                  id="book-pages"
                  type="number"
                  min={1}
                  max={20000}
                  value={value.pageCount}
                  onChange={(e) => patch({ pageCount: e.target.value })}
                  placeholder="320"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
