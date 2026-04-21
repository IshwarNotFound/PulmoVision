import { forwardRef } from "react";

import { cn } from "@/lib/utils";

interface PrimaryButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
}

export const PrimaryButton = forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  ({ className, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "primary-button relative inline-flex items-center justify-center gap-2 px-6 py-3 text-sm tracking-[0.16em]",
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="reading" style={{ fontSize: "11px" }}>
          ANALYZING...
        </span>
      ) : (
        children
      )}
    </button>
  ),
);

PrimaryButton.displayName = "PrimaryButton";
