import { cn } from "@/lib/utils";

export function DataReading({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="label">{label}</p>
      <p className="reading" style={{ fontSize: "16px" }}>
        {value}
      </p>
    </div>
  );
}
