/**
 * The single 18+ acknowledgement used on every signup surface. Workshop never
 * asks for a birthday — this attestation is the platform rule. Events and
 * venues may still set 18+/21+ door policies and check ID in person.
 */
export function AdultAttestationCheckbox({
  id,
  checked,
  onChange,
  className,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-2.5 text-left text-xs leading-relaxed text-ink-muted ${className ?? ""}`}
    >
      <input
        id={id}
        type="checkbox"
        required
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
      />
      <span>
        I confirm that I am 18 or older, and agree to Workshop's community terms and privacy
        practices.
      </span>
    </label>
  );
}
