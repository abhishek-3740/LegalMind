import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Scale, Mail, Lock, User, ArrowLeft, Chrome } from "lucide-react";
import { 
  loginSchema, 
  registerSchema, 
  resetPasswordSchema,
  LoginFormData,
  RegisterFormData,
  ResetPasswordFormData 
} from "@/lib/validations/auth";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

type AuthMode = "login" | "register" | "reset";

export default function AuthPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const { signIn, signUp, resetPassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const from = location.state?.from?.pathname || "/";

  const clearErrors = () => setErrors({});

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (error) {
        toast({
          title: "Google sign-in failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Redirecting...",
          description: "Signing you in with Google",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to sign in with Google. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async () => {
    clearErrors();
    
    try {
      const data = loginSchema.parse({ email, password });
      setLoading(true);
      
      const { error } = await signIn(data.email, data.password);
      
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Login failed",
            description: "Invalid email or password. Please try again.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Login failed",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Welcome back!",
          description: "You have successfully logged in.",
        });
        navigate(from, { replace: true });
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

  const handleRegister = async () => {
    clearErrors();
    
    try {
      const data = registerSchema.parse({ 
        email, 
        password, 
        confirmPassword, 
        fullName, 
        acceptTerms 
      });
      setLoading(true);
      
      const result = await signUp(data.email, data.password);
      const { error } = result;
      
      if (error) {
        if (error.message.includes("already registered")) {
          toast({
            title: "Account exists",
            description: "An account with this email already exists. Please login instead.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Registration failed",
            description: error.message,
            variant: "destructive",
          });
        }
      } else {
        if (result.needsConfirmation) {
          toast({
            title: "Check your email",
            description: "We've sent you a confirmation link. Please check your inbox to verify your account.",
          });
          navigate("/auth/confirm", { 
            state: { email: data.email },
            replace: true 
          });
        } else {
          toast({
            title: "Account created!",
            description: "Welcome to LegalMind. You are now logged in.",
          });
          navigate(from, { replace: true });
        }
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

  const handleResetPassword = async () => {
    clearErrors();
    
    try {
      const data = resetPasswordSchema.parse({ email });
      setLoading(true);
      
      const { error } = await resetPassword(data.email);
      
      if (error) {
        toast({
          title: "Reset failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Check your email",
          description: "We've sent you a password reset link.",
        });
        setMode("login");
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") handleLogin();
    else if (mode === "register") handleRegister();
    else handleResetPassword();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 safe-top safe-bottom">
      {/* Background gradient */}
      <div className="fixed inset-0 bg-gradient-dark opacity-50 pointer-events-none" />
      
      {/* Logo */}
      <Link to="/" className="relative z-10 flex items-center gap-2 mb-8">
        <div className="p-2 rounded-xl bg-gradient-primary">
          <Scale className="h-6 w-6 text-primary-foreground" />
        </div>
        <span className="font-display text-2xl font-bold gradient-text">LegalMind</span>
      </Link>

      <Card variant="glass" className="relative z-10 w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-2xl">
            {mode === "login" && "Welcome Back"}
            {mode === "register" && "Create Account"}
            {mode === "reset" && "Reset Password"}
          </CardTitle>
          <CardDescription>
            {mode === "login" && "Sign in to access your legal documents"}
            {mode === "register" && "Start analyzing contracts with AI"}
            {mode === "reset" && "Enter your email to receive a reset link"}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  icon={<User className="h-4 w-4" />}
                  disabled={loading}
                />
                {errors.fullName && (
                  <p className="text-xs text-destructive">{errors.fullName}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                icon={<Mail className="h-4 w-4" />}
                disabled={loading}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            {mode !== "reset" && (
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Lock className="h-4 w-4" />}
                  disabled={loading}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password}</p>
                )}
              </div>
            )}

            {mode === "register" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    icon={<Lock className="h-4 w-4" />}
                    disabled={loading}
                  />
                  {errors.confirmPassword && (
                    <p className="text-xs text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>

                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms"
                    checked={acceptTerms}
                    onCheckedChange={(checked) => setAcceptTerms(checked as boolean)}
                    disabled={loading}
                  />
                  <Label htmlFor="terms" className="text-sm text-muted-foreground leading-tight">
                    I agree to the Terms of Service and Privacy Policy
                  </Label>
                </div>
                {errors.acceptTerms && (
                  <p className="text-xs text-destructive">{errors.acceptTerms}</p>
                )}
              </>
            )}

            {mode === "login" && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                    disabled={loading}
                  />
                  <Label htmlFor="remember" className="text-sm text-muted-foreground">
                    Remember me
                  </Label>
                </div>
                <button
                  type="button"
                  onClick={() => setMode("reset")}
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <Button
              type="submit"
              variant="gradient"
              className="w-full"
              size="lg"
              loading={loading}
            >
              {mode === "login" && "Sign In"}
              {mode === "register" && "Create Account"}
              {mode === "reset" && "Send Reset Link"}
            </Button>

            {mode !== "reset" && (
              <>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border/30" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card/50 px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="glass"
                  className="w-full"
                  size="lg"
                  onClick={handleGoogleSignIn}
                  disabled={googleLoading}
                >
                  <Chrome className="h-4 w-4 mr-2" />
                  {googleLoading ? "Signing in..." : "Google"}
                </Button>
              </>
            )}
          </form>

          <div className="mt-6 text-center">
            {mode === "login" && (
              <p className="text-sm text-muted-foreground">
                Don't have an account?{" "}
                <button
                  onClick={() => setMode("register")}
                  className="text-primary hover:underline font-medium"
                >
                  Sign up
                </button>
              </p>
            )}
            {mode === "register" && (
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <button
                  onClick={() => setMode("login")}
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </button>
              </p>
            )}
            {mode === "reset" && (
              <button
                onClick={() => setMode("login")}
                className="text-sm text-primary hover:underline font-medium inline-flex items-center gap-1"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}