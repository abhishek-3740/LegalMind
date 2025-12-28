import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Scale, Mail, CheckCircle, AlertCircle, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function EmailConfirmation() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { resendConfirmation } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState<string>(
    location.state?.email || searchParams.get("email") || ""
  );
  const [resendLoading, setResendLoading] = useState(false);

  // Check if user came from email link
  const token = searchParams.get("token");
  const type = searchParams.get("type");

  useEffect(() => {
    // Handle email confirmation from URL hash
    const handleEmailConfirmation = async () => {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const type = hashParams.get("type");

      if (accessToken && type === "signup") {
        // Supabase handles the token automatically, but we can verify
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session && !error) {
          toast({
            title: "Email confirmed!",
            description: "Your account has been verified. Redirecting...",
          });
          setTimeout(() => {
            navigate("/", { replace: true });
          }, 2000);
        } else {
          toast({
            title: "Confirmation failed",
            description: "Unable to verify your email. Please try again.",
            variant: "destructive",
          });
        }
      }
    };

    handleEmailConfirmation();
  }, [navigate, toast]);

  const handleResend = async () => {
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter your email address.",
        variant: "destructive",
      });
      return;
    }

    setResendLoading(true);
    const { error } = await resendConfirmation(email);
    setResendLoading(false);

    if (error) {
      toast({
        title: "Failed to resend",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Email sent!",
        description: "We've sent you a new confirmation link. Please check your inbox.",
      });
    }
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
          <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="font-display text-2xl">
            Confirm Your Email
          </CardTitle>
          <CardDescription>
            We've sent a confirmation link to your email address. Please check your inbox and click the link to verify your account.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              icon={<Mail className="h-4 w-4" />}
              disabled={resendLoading}
            />
          </div>

          <Button
            variant="gradient"
            className="w-full"
            onClick={handleResend}
            loading={resendLoading}
          >
            Resend Confirmation Email
          </Button>

          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>Didn't receive the email? Check your spam folder or try resending. The confirmation link will expire after 24 hours.</p>
          </div>

          <div className="pt-4 border-t border-border">
            <Link
              to="/auth"
              className="text-sm text-primary hover:underline font-medium inline-flex items-center gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

