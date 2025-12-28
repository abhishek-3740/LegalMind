import { useState } from "react";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  User,
  Mail,
  Bell,
  Shield,
  LogOut,
  ChevronRight,
  Camera,
  Trash2
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const Profile = () => {
  const { user, signOut, updatePassword, updateProfile, deleteAccount } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.user_metadata?.display_name || user?.email?.split("@")[0] || "");
  const [notifications, setNotifications] = useState({
    analysisComplete: true,
    highRiskAlerts: true,
    weeklyDigest: false,
  });

  // Password change state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
    navigate("/");
  };

  const handleSave = async () => {
    try {
      const { error } = await updateProfile({ displayName });
      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your changes have been saved.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update profile.",
        variant: "destructive",
      });
    }
  };

  const handleChangePassword = async () => {
    // Validate inputs
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all password fields.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await updatePassword(newPassword);

      if (error) {
        toast({
          title: "Password change failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password changed",
          description: "Your password has been successfully updated.",
        });
        setPasswordDialogOpen(false);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to change password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setDeleteLoading(true);

      const { error } = await deleteAccount();

      if (error) throw error;

      toast({
        title: "Account deleted",
        description: "Your account has been successfully deleted.",
      });
      await signOut();
      navigate("/");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete account.";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Layout>
      <div className="px-4 pb-8">
        <PageHeader
          title="Profile"
          subtitle="Manage your account settings"
        />

        {/* Avatar Section */}
        <Card variant="glass" className="mb-6">
          <CardContent className="py-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="h-20 w-20 rounded-full bg-gradient-primary flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary-foreground">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <button className="absolute bottom-0 right-0 p-2 rounded-full bg-card border border-border hover:bg-muted transition-colors">
                  <Camera className="h-4 w-4" />
                </button>
              </div>
              <div>
                <h2 className="font-display font-bold text-lg">{displayName}</h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card variant="glass" className="mb-6">
          <CardHeader className="pb-2">
            <h3 className="font-display font-bold flex items-center gap-2">
              <User className="h-4 w-4" />
              Personal Information
            </h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                Display Name
              </label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">
                Email
              </label>
              <Input
                value={user?.email || ""}
                disabled
                icon={<Mail className="h-4 w-4" />}
              />
            </div>
            <Button variant="gradient" onClick={handleSave} className="w-full">
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card variant="glass" className="mb-6">
          <CardHeader className="pb-2">
            <h3 className="font-display font-bold flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </h3>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Analysis Complete</p>
                <p className="text-xs text-muted-foreground">
                  Get notified when document analysis is done
                </p>
              </div>
              <Switch
                checked={notifications.analysisComplete}
                onCheckedChange={(checked) =>
                  setNotifications(prev => ({ ...prev, analysisComplete: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">High Risk Alerts</p>
                <p className="text-xs text-muted-foreground">
                  Immediate alerts for high-risk findings
                </p>
              </div>
              <Switch
                checked={notifications.highRiskAlerts}
                onCheckedChange={(checked) =>
                  setNotifications(prev => ({ ...prev, highRiskAlerts: checked }))
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Weekly Digest</p>
                <p className="text-xs text-muted-foreground">
                  Summary of all activity each week
                </p>
              </div>
              <Switch
                checked={notifications.weeklyDigest}
                onCheckedChange={(checked) =>
                  setNotifications(prev => ({ ...prev, weeklyDigest: checked }))
                }
              />
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card variant="glass" className="mb-6">
          <CardHeader className="pb-2">
            <h3 className="font-display font-bold flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Security
            </h3>
          </CardHeader>
          <CardContent>
            <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
              <button
                className="w-full flex items-center justify-between py-3 hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors text-left"
                onClick={() => setPasswordDialogOpen(true)}
              >
                <span className="text-sm">Change Password</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>

              <DialogContent className="glass">
                <DialogHeader>
                  <DialogTitle>Change Password</DialogTitle>
                  <DialogDescription>
                    Enter your new password below. Make sure it's at least 6 characters long.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      Current Password
                    </label>
                    <Input
                      type="password"
                      placeholder="Enter current password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      disabled={passwordLoading}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      New Password
                    </label>
                    <Input
                      type="password"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={passwordLoading}
                    />
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground mb-1 block">
                      Confirm New Password
                    </label>
                    <Input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      disabled={passwordLoading}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setPasswordDialogOpen(false)}
                    disabled={passwordLoading}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="gradient"
                    onClick={handleChangePassword}
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? "Updating..." : "Update Password"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <div className="space-y-3">
          <Button
            variant="glass"
            className="w-full justify-start"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="glass">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Account</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete your
                  account and remove all your data from our servers.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteAccount}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;