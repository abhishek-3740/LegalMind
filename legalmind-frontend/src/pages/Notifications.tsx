import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft,
  Bell, 
  FileText, 
  AlertTriangle, 
  CheckCircle,
  Trash2,
  Check
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface Notification {
  id: string;
  type: "analysis" | "risk" | "system";
  title: string;
  description: string;
  timestamp: string;
  read: boolean;
  documentId?: string;
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "risk",
    title: "High Risk Detected",
    description: "Service Agreement - Acme Corp has 2 high-risk clauses",
    timestamp: "2 hours ago",
    read: false,
    documentId: "1",
  },
  {
    id: "2",
    type: "analysis",
    title: "Analysis Complete",
    description: "NDA - Tech Partners Inc has been analyzed",
    timestamp: "5 hours ago",
    read: false,
    documentId: "2",
  },
  {
    id: "3",
    type: "system",
    title: "Welcome to LegalMind",
    description: "Get started by uploading your first document",
    timestamp: "1 day ago",
    read: true,
  },
  {
    id: "4",
    type: "analysis",
    title: "Analysis Complete",
    description: "Employment Contract analysis is ready",
    timestamp: "3 days ago",
    read: true,
    documentId: "3",
  },
];

const notificationIcons = {
  analysis: CheckCircle,
  risk: AlertTriangle,
  system: Bell,
};

const notificationColors = {
  analysis: "text-success bg-success/10",
  risk: "text-destructive bg-destructive/10",
  system: "text-primary bg-primary/10",
};

type FilterType = "all" | "unread" | "analysis" | "risk";

const Notifications = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState(mockNotifications);
  const [filter, setFilter] = useState<FilterType>("all");

  const unreadCount = notifications.filter(n => !n.read).length;

  const filteredNotifications = notifications.filter(n => {
    if (filter === "unread") return !n.read;
    if (filter === "analysis") return n.type === "analysis";
    if (filter === "risk") return n.type === "risk";
    return true;
  });

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast({
      title: "All caught up!",
      description: "All notifications marked as read",
    });
  };

  const clearAll = () => {
    setNotifications([]);
    toast({
      title: "Cleared",
      description: "All notifications have been cleared",
    });
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.documentId) {
      navigate(`/document/${notification.documentId}`);
    }
  };

  return (
    <Layout showNavigation={false}>
      <div className="pb-8">
        {/* Header */}
        <header className="px-4 py-4 safe-top glass border-b border-border/30 sticky top-0 z-40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate(-1)}
                className="p-2 rounded-xl hover:bg-card/80 transition-colors touch-target"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="font-display font-bold">Notifications</h1>
                {unreadCount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {unreadCount} unread
                  </p>
                )}
              </div>
            </div>
            {notifications.length > 0 && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                  <Check className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={clearAll}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </header>

        <div className="px-4 pt-4">
          {/* Filters */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {(["all", "unread", "analysis", "risk"] as FilterType[]).map((f) => (
              <Button
                key={f}
                variant={filter === f ? "default" : "glass"}
                size="sm"
                onClick={() => setFilter(f)}
                className="shrink-0"
              >
                {f === "all" && "All"}
                {f === "unread" && `Unread (${unreadCount})`}
                {f === "analysis" && "Analysis"}
                {f === "risk" && "Risk Alerts"}
              </Button>
            ))}
          </div>

          {/* Notification List */}
          {filteredNotifications.length > 0 ? (
            <div className="space-y-3">
              {filteredNotifications.map((notification) => {
                const Icon = notificationIcons[notification.type];
                const colorClass = notificationColors[notification.type];
                
                return (
                  <Card 
                    key={notification.id}
                    variant="interactive"
                    className={cn(
                      "cursor-pointer",
                      !notification.read && "border-primary/30"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <CardContent className="p-4">
                      <div className="flex gap-3">
                        <div className={cn("p-2 rounded-lg shrink-0", colorClass)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn(
                              "font-medium text-sm",
                              !notification.read && "font-semibold"
                            )}>
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {notification.description}
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            {notification.timestamp}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="p-4 rounded-full bg-muted w-fit mx-auto mb-4">
                <Bell className="h-10 w-10 text-muted-foreground" />
              </div>
              <h2 className="font-display font-bold mb-2">No notifications</h2>
              <p className="text-sm text-muted-foreground">
                {filter !== "all" 
                  ? "Try changing your filter" 
                  : "You're all caught up!"}
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Notifications;