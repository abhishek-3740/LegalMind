import { FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface Document {
  id: string;
  title: string;
  updatedAt: string;
  status: "safe" | "high-risk" | "analyzing";
  riskScore?: number;
}

interface DocumentCardProps {
  document: Document;
  variant?: "compact" | "detailed";
  onClick?: () => void;
  showAnalyzeButton?: boolean;
}

export function DocumentCard({ 
  document, 
  variant = "compact", 
  onClick,
  showAnalyzeButton = false 
}: DocumentCardProps) {
  const statusVariant = document.status === "safe" ? "safe" : 
    document.status === "high-risk" ? "high-risk" : "secondary";
  
  const statusLabel = document.status === "safe" ? "Safe" : 
    document.status === "high-risk" ? "High Risk" : "Analyzing";

  return (
    <Card 
      variant="interactive" 
      className={cn("cursor-pointer", onClick && "hover:border-primary/30")}
      onClick={onClick}
    >
      <CardContent className={cn(
        "flex items-center gap-4",
        variant === "compact" ? "p-4" : "p-5"
      )}>
        <div className="p-3 rounded-xl bg-primary/10 shrink-0">
          <FileText className={cn(
            "text-primary",
            variant === "compact" ? "h-6 w-6" : "h-8 w-8"
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn(
            "font-medium truncate",
            variant === "detailed" && "text-lg"
          )}>
            {document.title}
          </p>
          <p className="text-xs text-muted-foreground">
            Updated {document.updatedAt}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant={statusVariant}>{statusLabel}</Badge>
          {showAnalyzeButton && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onClick?.();
              }}
            >
              Analyze
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Grid view card variant
export function DocumentGridCard({ 
  document, 
  onClick 
}: { 
  document: Document; 
  onClick?: () => void 
}) {
  const statusVariant = document.status === "safe" ? "safe" : 
    document.status === "high-risk" ? "high-risk" : "secondary";
  
  const statusLabel = document.status === "safe" ? "Safe" : 
    document.status === "high-risk" ? "High Risk" : "Analyzing";

  return (
    <Card 
      variant="interactive" 
      className="cursor-pointer"
      onClick={onClick}
    >
      <CardContent className="p-4 flex flex-col items-center text-center">
        <div className="p-4 rounded-xl bg-primary/10 mb-3">
          <FileText className="h-10 w-10 text-primary" />
        </div>
        <p className="font-medium truncate w-full text-sm mb-1">
          {document.title}
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          {document.updatedAt}
        </p>
        <Badge variant={statusVariant} className="text-xs">
          {statusLabel}
        </Badge>
      </CardContent>
    </Card>
  );
}