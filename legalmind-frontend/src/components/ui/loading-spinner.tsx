import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "default" | "lg" | "xl";
  className?: string;
}

const sizeClasses = {
  sm: "h-4 w-4",
  default: "h-6 w-6",
  lg: "h-8 w-8",
  xl: "h-12 w-12",
};

export function LoadingSpinner({ size = "default", className }: LoadingSpinnerProps) {
  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      <div
        className={cn(
          "absolute inset-0 rounded-full border-2 border-primary/20",
          sizeClasses[size]
        )}
      />
      <div
        className={cn(
          "absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin",
          sizeClasses[size]
        )}
      />
    </div>
  );
}

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = "Loading..." }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="xl" />
        <p className="text-muted-foreground font-medium animate-pulse-subtle">{message}</p>
      </div>
    </div>
  );
}

interface LoadingDotsProps {
  className?: string;
}

export function LoadingDots({ className }: LoadingDotsProps) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
      <div className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
      <div className="h-2 w-2 rounded-full bg-primary animate-bounce" />
    </div>
  );
}