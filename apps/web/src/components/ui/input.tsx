import { cn } from "@/lib/utils";
import * as React from "react";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  return (
    <input
      ref={ref}
      className={cn(
        "border-border h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm outline-none",
        "focus-visible:ring-primary focus-visible:ring-2",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";
