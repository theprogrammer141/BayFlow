import * as React from "react";
import { cn } from "cn";
import { Loader2 } from "lucide-react";

interface SpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "default" | "lg" | "xl";
  label?: string;
}

const SIZE_MAP = {
  sm: "size-4",
  default: "size-6",
  lg: "size-8",
  xl: "size-12",
};

export function Spinner({
  size = "default",
  label = "Loading...",
  className,
  ...props
}: SpinnerProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn("inline-flex items-center justify-center", className)}
      {...props}
    >
      <Loader2
        className={cn("animate-spin text-primary", SIZE_MAP[size])}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}
