/**
 * Admin trigger for the verified Chicago recurring-events seed.
 * Safe to press repeatedly: the seed is idempotent.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { seedChicagoEvents } from "@/lib/seed/chicago-events.functions";

export function SeedChicagoButton({ onSeeded }: { onSeeded?: () => void }) {
  const seedFn = useServerFn(seedChicagoEvents);
  const [running, setRunning] = useState(false);

  async function run() {
    setRunning(true);
    try {
      const res = await seedFn();
      const added = res.results.reduce((n, r) => n + r.occurrences_added, 0);
      const created = res.results.filter((r) => r.action === "created").length;
      toast.success(
        added === 0
          ? "Chicago seed already up to date — nothing duplicated."
          : `Chicago seed run: ${created} new listing${created === 1 ? "" : "s"}, ${added} dated occurrence${added === 1 ? "" : "s"} added.`,
      );
      onSeeded?.();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Button variant="outline" className="rounded-full" onClick={run} disabled={running}>
      {running ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <MapPin className="mr-1 h-4 w-4" />}
      Seed Chicago
    </Button>
  );
}
