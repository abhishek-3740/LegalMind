import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the session from URL fragment
        const { data, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (data.session) {
          toast({
            title: "Success!",
            description: "You have been signed in successfully.",
          });
          // Redirect to dashboard after a short delay
          setTimeout(() => {
            navigate("/dashboard", { replace: true });
          }, 1000);
        } else {
          // Check if there's an error in the URL
          const errorCode = searchParams.get("error");
          const errorDescription = searchParams.get("error_description");
          
          if (errorCode) {
            setError(errorDescription || "Authentication failed");
            toast({
              title: "Authentication failed",
              description: errorDescription || "Please try again.",
              variant: "destructive",
            });
          } else {
            setError("No session found. Please try signing in again.");
            toast({
              title: "Session not found",
              description: "Please try signing in again.",
              variant: "destructive",
            });
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "An error occurred";
        setError(message);
        toast({
          title: "Error",
          description: message,
          variant: "destructive",
        });
      }
    };

    handleCallback();
  }, [navigate, toast, searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center space-y-4">
        {error ? (
          <>
            <h1 className="text-2xl font-bold">Authentication Error</h1>
            <p className="text-muted-foreground">{error}</p>
            <button
              onClick={() => navigate("/auth", { replace: true })}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
            >
              Back to Login
            </button>
          </>
        ) : (
          <>
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <h1 className="text-xl font-semibold">Signing you in...</h1>
            <p className="text-sm text-muted-foreground">
              Please wait while we complete your authentication.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
