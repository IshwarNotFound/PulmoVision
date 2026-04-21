import { cn } from "@/lib/utils";

export function Badge({
  children,
  tone,
  className,
}: {
  children: React.ReactNode;
  tone: "normal" | "attention";
  className?: string;
}) {
  const color = tone === "normal" ? "var(--color-normal)" : "var(--color-attention)";

  return (
    <span className={cn("badge", className)} style={{ color }}>
      <span className="badge-dot" style={{ background: color }} />
      {children}
    </span>
  );
}
