import { Sparkles, MapPin, BadgeCheck, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "standard" | "founding_creator" | "city_host" | "verified_creator" | "admin" | string | null | undefined;

const META: Record<string, { label: string; icon: any; className: string }> = {
  founding_creator: {
    label: "Founding",
    icon: Sparkles,
    className: "bg-gradient-to-r from-violet/15 to-coral/15 text-violet ring-1 ring-violet/30",
  },
  city_host: {
    label: "City Host",
    icon: MapPin,
    className: "bg-coral/10 text-coral ring-1 ring-coral/30",
  },
  verified_creator: {
    label: "Verified",
    icon: BadgeCheck,
    className: "bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/30",
  },
  admin: {
    label: "Admin",
    icon: Shield,
    className: "bg-ink/10 text-ink ring-1 ring-ink/30",
  },
};

export function CreatorBadge({ status, size = "sm", showLabel = true, className }: {
  status: Status;
  size?: "xs" | "sm";
  showLabel?: boolean;
  className?: string;
}) {
  if (!status || status === "standard") return null;
  const meta = META[status];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span
      title={meta.label}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium",
        meta.className,
        size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]",
        className,
      )}
    >
      <Icon className={size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5"} />
      {showLabel && <span>{meta.label}</span>}
    </span>
  );
}
