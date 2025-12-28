import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const inputVariants = cva(
  "flex w-full rounded-lg text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200",
  {
    variants: {
      variant: {
        default: "border border-input bg-background px-4 py-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        glass: "border border-border/50 bg-input/50 backdrop-blur-sm px-4 py-2 focus:border-primary/50 focus:ring-2 focus:ring-primary/20",
        filled: "border-0 bg-muted px-4 py-2 focus:bg-muted/80 focus:ring-2 focus:ring-primary/20",
      },
      inputSize: {
        default: "h-11",
        sm: "h-9 text-sm px-3",
        lg: "h-12 text-lg px-5",
      },
    },
    defaultVariants: {
      variant: "glass",
      inputSize: "default",
    },
  }
);

export interface InputProps
  extends Omit<React.ComponentProps<"input">, "size">,
    VariantProps<typeof inputVariants> {
  icon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, variant, inputSize, icon, ...props }, ref) => {
    if (icon) {
      return (
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {icon}
          </div>
          <input
            type={type}
            className={cn(inputVariants({ variant, inputSize }), "pl-10", className)}
            ref={ref}
            {...props}
          />
        </div>
      );
    }

    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, inputSize }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input, inputVariants };