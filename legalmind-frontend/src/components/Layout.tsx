import { ReactNode } from "react";
import { Home, Folder, MessageCircle, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: ReactNode;
  showNavigation?: boolean;
}

const navItems = [
  { icon: Home, label: "Dashboard", path: "/dashboard" },
  { icon: Folder, label: "Documents", path: "/documents" },
  { icon: MessageCircle, label: "Chat", path: "/chat" },
  { icon: User, label: "Profile", path: "/profile" },
];

export function Layout({ children, showNavigation = true }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main content */}
      <main className={cn(
        "flex-1 overflow-auto",
        showNavigation && "pb-20" // Space for bottom nav
      )}>
        {children}
      </main>

      {/* Bottom Navigation */}
      {showNavigation && <BottomNavigation />}
    </div>
  );
}

function BottomNavigation() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="glass border-t border-border/30 px-4 py-2">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || 
              (item.path === "/dashboard" && location.pathname === "/");
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={cn(
                  "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 touch-target",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "p-2 rounded-xl transition-all duration-200",
                  isActive && "bg-primary/10 shadow-glow-sm"
                )}>
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-medium">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

// Header component for pages
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="px-4 py-6 safe-top">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">{title}</h1>
          {subtitle && (
            <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>
          )}
        </div>
        {action}
      </div>
    </header>
  );
}