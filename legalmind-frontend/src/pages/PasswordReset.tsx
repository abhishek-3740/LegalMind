import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Check } from "lucide-react";
import { z } from "zod";

const resetPasswordSchema = z
  .object({
    email: z.string().email("Invalid email"),
  })
  .strict();

const updatePasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type ResetStep = "request" | "checkEmail" | "update" | "success";

export default function PasswordResetPage() {
  const [step, setStep] = useState<ResetStep>("request");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Request step
  const [email, setEmail] = useState("");
  
  // Update step
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const { resetPassword, updatePassword, session } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();

  // Check if we're in the update password step (user clicked email link from Supabase)
  // Supabase automatically creates a session when the user clicks the reset link
  useEffect(() => {
    const type = searchParams.get("type");
    
    // Check if there's an active session and this is a recovery type redirect
    if (session?.user && type === "recovery") {
      setStep("update");
    }
  }, [session, searchParams]);

  const clearErrors = () => setErrors({});

  const handleRequestReset = async () => {
    clearErrors();
    
    try {
      const data = resetPasswordSchema.parse({ email });
      setLoading(true);
      
      const { error } = await resetPassword(data.email);
      
      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to send reset email. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Check your email!",
          description: "We've sent a password reset link to " + data.email,
        });
        // Show the check email screen
        setStep("checkEmail");
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) {
            fieldErrors[e.path[0] as string] = e.message;
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    clearErrors();
    
    try {
      const data = updatePasswordSchema.parse({ 
        password, 
        confirmPassword 
      });
      setLoading(true);
      
      const { error } = await updatePassword(data.password);
      
      if (error) {
        toast({
          title: "Error",
          description: error.message || "Failed to update password. Please try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Password updated",
          description: "Your password has been successfully reset. You can now login.",
        });
        setStep("success");
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) {
            fieldErrors[e.path[0] as string] = e.message;
          }
        });
        setErrors(fieldErrors);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">LegalMind</h1>
          <p className="text-slate-400">Reset Your Password</p>
        </div>

        {/* Request Reset Email Step */}
        {step === "request" && (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white">Forgot Password?</CardTitle>
              <CardDescription className="text-slate-400">
                Enter your email address and we'll send you a link to reset your password.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-300">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
                {errors.email && (
                  <p className="text-sm text-red-400">{errors.email}</p>
                )}
              </div>

              <Button
                onClick={handleRequestReset}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>

              <div className="text-center">
                <Link
                  to="/auth"
                  className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Check Email Step */}
        {step === "checkEmail" && (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-blue-900/30 p-3 rounded-full">
                  <Check className="w-6 h-6 text-blue-400" />
                </div>
              </div>
              <CardTitle className="text-white">Check Your Email</CardTitle>
              <CardDescription className="text-slate-400">
                We've sent a password reset link to <span className="text-white font-semibold">{email}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-400 text-center">
                Click the link in the email to reset your password. The link will expire in 24 hours.
              </p>

              <Button
                onClick={() => {
                  setStep("request");
                  setEmail("");
                }}
                variant="outline"
                className="w-full border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                Send Another Email
              </Button>

              <div className="text-center">
                <Link
                  to="/auth"
                  className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Update Password Step */}
        {step === "update" && (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardHeader>
              <CardTitle className="text-white">Set New Password</CardTitle>
              <CardDescription className="text-slate-400">
                Enter your new password to regain access to your account.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">
                  New Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
                {errors.password && (
                  <p className="text-sm text-red-400">{errors.password}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-slate-300">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-red-400">{errors.confirmPassword}</p>
                )}
              </div>

              <Button
                onClick={handleUpdatePassword}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {loading ? "Updating..." : "Update Password"}
              </Button>

              <div className="text-center">
                <Link
                  to="/auth"
                  className="inline-flex items-center text-sm text-blue-400 hover:text-blue-300"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Step */}
        {step === "success" && (
          <Card className="border-green-700 bg-slate-800/50">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="bg-green-900/30 p-3 rounded-full">
                  <Check className="w-6 h-6 text-green-400" />
                </div>
              </div>
              <CardTitle className="text-white">Password Reset Successfully</CardTitle>
              <CardDescription className="text-slate-400">
                Your password has been updated. You can now login with your new password.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => navigate("/auth")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                Go to Login
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
