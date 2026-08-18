/**
 * Shared "What is this about?" Topic picker.
 *
 * One search-first control used by Work, Blog, Collab, Group, Event, and
 * Resource authoring. Selections are canonical Topic records — never
 * free-text — so a Work and a Blog post about Spirituality attach the same id.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cleanTopicLabel, normalizeTopicKey, topicLabelError } from "@/lib/topics/normalize";
import { createTopic, topicSearch } from "@/lib/topics.functions";

export type PickerTopic = {
  id: string;
  slug: string;
  name: string;
  short_description?: string | null;
  family?: string | null;
  status?: string | null;
};

type Props = {
  value: PickerTopic[];
  onChange: (next: PickerTopic[]) => void;
  max?: number;
  /** Extra context shown under the section label. */
  helper?: string;
  disabled?: boolean;
  label?: string;
};

export function TopicPicker({
  value,
  onChange,
  max = 5,
  helper = "What is this about?",
  disabled = false,
  label = "Topics",
}: Props) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const atLimit = value.length >= max;

  const remove = (id: string) => onChange(value.filter((t) => t.id !== id));
  const add = (topic: PickerTopic) => {
    if (value.some((t) => t.id === topic.id)) return;
    if (value.length >= max) {
      toast.error(`You can add up to ${max} topics.`);
      return;
    }
    onChange([...value, topic]);
  };

  const panel = (
    <TopicSearchPanel
      selected={value}
      onSelect={(topic) => {
        add(topic);
        setOpen(false);
      }}
      max={max}
      remaining={max - value.length}
    />
  );

  return (
    <div className="space-y-2">
      <div>
        <div className="text-[13px] font-semibold text-ink">{label}</div>
        {helper ? <p className="text-[12px] text-ink-muted">{helper}</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {value.map((topic) => {
          const retired = topic.status && topic.status !== "active";
          return (
            <span
              key={topic.id}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] ${
                retired
                  ? "border-dashed border-border text-ink-muted"
                  : "border-border bg-surface text-ink"
              }`}
            >
              {topic.name}
              {retired ? <span className="text-[10px] uppercase tracking-wide">Retired</span> : null}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(topic.id)}
                  aria-label={`Remove topic ${topic.name}`}
                  className="-mr-1 grid h-5 w-5 place-items-center rounded-full text-ink-muted hover:text-ink"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          );
        })}

        {!disabled &&
          (isMobile ? (
            <>
              <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={atLimit}
                className="inline-flex min-h-[44px] items-center gap-1 rounded-full border border-dashed border-border px-3 text-[12px] text-ink-soft disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" /> Add a topic
              </button>
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent side="bottom" className="h-[75vh] p-0">
                  <div className="h-full overflow-hidden p-4">{panel}</div>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  disabled={atLimit}
                  className="inline-flex items-center gap-1 rounded-full border border-dashed border-border px-3 py-1.5 text-[12px] text-ink-soft disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" /> Add a topic
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[360px] p-3">
                {panel}
              </PopoverContent>
            </Popover>
          ))}
      </div>

      {atLimit ? (
        <p className="text-[11px] text-ink-muted">You can add up to {max} topics.</p>
      ) : null}
    </div>
  );
}

function TopicSearchPanel({
  selected,
  onSelect,
  max,
  remaining,
}: {
  selected: PickerTopic[];
  onSelect: (topic: PickerTopic) => void;
  max: number;
  remaining: number;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PickerTopic[]>([]);
  const [exactMatchId, setExactMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedIds = useMemo(() => new Set(selected.map((t) => t.id)), [selected]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const term = query.trim();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await topicSearch({ data: { q: term, limit: term ? 12 : 8 } });
        if (cancelled) return;
        setResults(res.topics as PickerTopic[]);
        setExactMatchId(res.exactMatchId);
        setActiveIndex(0);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, term ? 180 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const trimmed = cleanTopicLabel(query);
  const normalized = normalizeTopicKey(trimmed);
  const matchesExisting =
    !!exactMatchId ||
    results.some((t) => normalizeTopicKey(t.name) === normalized);
  const canCreate = trimmed.length >= 2 && !matchesExisting && remaining > 0;

  const handleCreate = useCallback(async () => {
    const error = topicLabelError(trimmed);
    if (error) {
      toast.error(error);
      return;
    }
    setCreating(true);
    try {
      const res = await createTopic({ data: { label: trimmed } });
      onSelect(res.topic as PickerTopic);
      setQuery("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "That topic couldn't be added.");
    } finally {
      setCreating(false);
    }
  }, [trimmed, onSelect]);

  const rows = results;

  return (
    <div className="flex h-full flex-col gap-2">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search topics…"
        aria-label="Search topics"
        className="h-11 w-full rounded-full border border-border bg-surface px-4 text-[14px] text-ink outline-none focus:border-ink/40"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, rows.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            const row = rows[activeIndex];
            if (row && !selectedIds.has(row.id)) onSelect(row);
            else if (canCreate) void handleCreate();
          }
        }}
      />

      <p className="px-1 text-[11px] uppercase tracking-[0.12em] text-ink-muted">
        {query.trim() ? "Possible matches" : "Suggested"}
      </p>

      <div className="min-h-0 flex-1 overflow-y-auto" role="listbox" aria-label="Topics">
        {loading && rows.length === 0 ? (
          <div className="flex items-center gap-2 px-1 py-3 text-[12px] text-ink-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
          </div>
        ) : null}

        {rows.map((topic, index) => {
          const isSelected = selectedIds.has(topic.id);
          return (
            <button
              key={topic.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              disabled={isSelected || remaining <= 0}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => onSelect(topic)}
              className={`flex min-h-[44px] w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-[13px] ${
                index === activeIndex ? "bg-surface-muted" : ""
              } ${isSelected ? "opacity-50" : "hover:bg-surface-muted"}`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{topic.name}</span>
                {topic.short_description || topic.family ? (
                  <span className="block truncate text-[11px] text-ink-muted">
                    {topic.short_description ?? topic.family}
                  </span>
                ) : null}
              </span>
              {isSelected ? (
                <span className="shrink-0 text-[11px] text-ink-muted">Selected</span>
              ) : null}
            </button>
          );
        })}

        {!loading && rows.length === 0 && !canCreate ? (
          <p className="px-2 py-3 text-[12px] text-ink-muted">No topics found.</p>
        ) : null}
      </div>

      {canCreate ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={creating}
          onClick={() => void handleCreate()}
          className="justify-start"
        >
          {creating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Plus className="mr-2 h-3.5 w-3.5" />}
          Add “{trimmed}” as a new Topic
        </Button>
      ) : null}

      {remaining <= 0 ? (
        <p className="px-1 text-[11px] text-ink-muted">You can add up to {max} topics.</p>
      ) : null}
    </div>
  );
}

export default TopicPicker;
