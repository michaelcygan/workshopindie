import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { GlobalLocationCombobox, type SelectedLocation } from "@/components/global-location-combobox";
import { ensureLocationAndOfficialGroup } from "@/lib/geo/locations.functions";
import type { CityValue } from "@/components/city-combobox";

/**
 * Authoring-side location picker.
 *
 * Same shape as CityCombobox (which stays filter-only), but searches the whole
 * world. Picking a place Workshop doesn't have yet provisions that locality and
 * its official group before returning it.
 */
export function AuthoringLocationPicker({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  /** Join the official city group when a place is picked. */
  join = false,
}: {
  value: CityValue | null;
  onChange: (next: CityValue | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  join?: boolean;
}) {
  const ensure = useServerFn(ensureLocationAndOfficialGroup);
  const [busy, setBusy] = useState(false);

  const selected: SelectedLocation | null = value
    ? { cityId: value.id, providerId: null, name: value.name, sublabel: value.country ?? "" }
    : null;

  async function handleSelect(option: SelectedLocation) {
    if (option.cityId) {
      onChange({ id: option.cityId, name: option.name, country: option.sublabel || null });
      return;
    }
    if (!option.providerId) return;
    setBusy(true);
    try {
      const res = await ensure({ data: { providerId: option.providerId, join } });
      onChange({ id: res.cityId, name: res.name, country: option.sublabel || null });
      if (res.created) toast.success(`Welcome to Workshop ${res.name}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't add that location");
    } finally {
      setBusy(false);
    }
  }

  return (
    <GlobalLocationCombobox
      value={selected}
      busy={busy}
      disabled={disabled}
      className={className}
      placeholder={placeholder ?? "Search any city or town"}
      onSelect={handleSelect}
      onClear={() => onChange(null)}
    />
  );
}
