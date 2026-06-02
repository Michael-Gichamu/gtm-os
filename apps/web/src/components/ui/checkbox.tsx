"use client";
import * as React from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Tri-state checkbox primitive without pulling @radix-ui/react-checkbox in
 * — the leads table only needs check / unchecked / indeterminate (the
 * "some selected" header state). Stops propagation so a click in the
 * checkbox doesn't trigger the surrounding row click.
 */
interface Props {
  checked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (next: boolean) => void;
  className?: string;
  "aria-label"?: string;
}

export function Checkbox({ checked, indeterminate, onCheckedChange, className, ...rest }: Props) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : !!checked}
      onClick={(e) => {
        e.stopPropagation();
        onCheckedChange?.(!checked);
      }}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          e.stopPropagation();
          onCheckedChange?.(!checked);
        }
      }}
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-input transition-colors",
        (checked || indeterminate) && "bg-primary text-primary-foreground border-primary",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
      {...rest}
    >
      {indeterminate ? <Minus className="h-3 w-3" /> : checked ? <Check className="h-3 w-3" /> : null}
    </button>
  );
}
