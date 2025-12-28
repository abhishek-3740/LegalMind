import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  icon: LucideIcon;
  value: number | string;
  label: string;
  variant?: "default" | "danger" | "success";
}

export function StatsCard({ icon: Icon, value, label, variant = "default" }: StatsCardProps) {
  return (
    <Card variant="glass" className="text-center">
      <CardContent className="p-4">
        <div className="flex justify-center mb-2">
          <div className={cn(
            "p-2 rounded-lg",
            variant === "default" && "bg-primary/10",
            variant === "danger" && "bg-destructive/10 glow-danger",
            variant === "success" && "bg-success/10 glow-success"
          )}>
            <Icon className={cn(
              "h-5 w-5",
              variant === "default" && "text-primary",
              variant === "danger" && "text-destructive",
              variant === "success" && "text-success"
            )} />
          </div>
        </div>
        <p className={cn(
          "text-2xl font-bold font-display",
          variant === "danger" && "text-destructive",
          variant === "success" && "text-success"
        )}>
          {value}
        </p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}