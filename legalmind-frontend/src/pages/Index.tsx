import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { LoadingSpinner, LoadingDots } from "@/components/ui/loading-spinner";
import { FileText, AlertTriangle, ShieldCheck, Search, Bell, Plus, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
  };

  return (
    <Layout>
      <div className="px-4 pb-8">
        {/* Header */}
        <PageHeader
          title={`Welcome${user?.email ? `, ${user.email.split('@')[0]}` : ''}`}
          subtitle="Your legal documents at a glance"
          action={
            <div className="flex items-center gap-2">
              <button className="p-2 rounded-xl glass hover:bg-card/80 transition-colors touch-target relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
              </button>
              <button 
                onClick={handleSignOut}
                className="p-2 rounded-xl glass hover:bg-card/80 transition-colors touch-target"
                title="Sign out"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          }
        />

        {/* Search Bar */}
        <div className="mb-6">
          <Input
            placeholder="Search documents..."
            icon={<Search className="h-4 w-4" />}
            className="rounded-full"
          />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <Card variant="glass" className="text-center">
            <CardContent className="p-4">
              <div className="flex justify-center mb-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
              </div>
              <p className="text-2xl font-bold font-display">24</p>
              <p className="text-xs text-muted-foreground">Contracts</p>
            </CardContent>
          </Card>

          <Card variant="glass" className="text-center">
            <CardContent className="p-4">
              <div className="flex justify-center mb-2">
                <div className="p-2 rounded-lg bg-destructive/10 glow-danger">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
              </div>
              <p className="text-2xl font-bold font-display text-destructive">3</p>
              <p className="text-xs text-muted-foreground">Risks</p>
            </CardContent>
          </Card>

          <Card variant="glass" className="text-center">
            <CardContent className="p-4">
              <div className="flex justify-center mb-2">
                <div className="p-2 rounded-lg bg-success/10 glow-success">
                  <ShieldCheck className="h-5 w-5 text-success" />
                </div>
              </div>
              <p className="text-2xl font-bold font-display text-success">21</p>
              <p className="text-xs text-muted-foreground">Safe</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Documents */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold">Recent Documents</h2>
            <Button variant="ghost" size="sm">View All</Button>
          </div>

          <div className="space-y-3">
            <Card variant="interactive">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">Service Agreement - Acme Corp</p>
                  <p className="text-xs text-muted-foreground">Updated 2 hours ago</p>
                </div>
                <Badge variant="high-risk">High Risk</Badge>
              </CardContent>
            </Card>

            <Card variant="interactive">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">NDA - Tech Partners Inc</p>
                  <p className="text-xs text-muted-foreground">Updated yesterday</p>
                </div>
                <Badge variant="safe">Safe</Badge>
              </CardContent>
            </Card>

            <Card variant="interactive">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">Employment Contract</p>
                  <p className="text-xs text-muted-foreground">Updated 3 days ago</p>
                </div>
                <Badge variant="safe">Safe</Badge>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Design System Demo */}
        <div className="space-y-6 mt-8 pt-8 border-t border-border/30">
          <h2 className="font-display text-lg font-bold gradient-text">Design System Demo</h2>
          
          {/* Buttons */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Buttons</h3>
            <div className="flex flex-wrap gap-2">
              <Button variant="gradient">Gradient</Button>
              <Button variant="default">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="glass">Glass</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
            </div>
            <div className="flex gap-2">
              <Button loading>Loading</Button>
              <Button variant="gradient" size="lg">Large</Button>
              <Button size="sm">Small</Button>
            </div>
          </div>

          {/* Badges */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Badges</h3>
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="danger">Danger</Badge>
              <Badge variant="safe">Safe</Badge>
              <Badge variant="high-risk">High Risk</Badge>
              <Badge variant="glass">Glass</Badge>
            </div>
          </div>

          {/* Loading States */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Loading States</h3>
            <div className="flex items-center gap-6">
              <LoadingSpinner size="sm" />
              <LoadingSpinner />
              <LoadingSpinner size="lg" />
              <LoadingDots />
            </div>
          </div>

          {/* Inputs */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Inputs</h3>
            <Input placeholder="Glass input (default)" />
            <Input variant="filled" placeholder="Filled input" />
            <Input variant="default" placeholder="Default input" />
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <button className="fixed bottom-24 right-4 h-14 w-14 rounded-full bg-gradient-primary shadow-glow flex items-center justify-center text-primary-foreground hover:scale-105 transition-transform touch-target z-40">
        <Plus className="h-6 w-6" />
      </button>
    </Layout>
  );
};

export default Index;