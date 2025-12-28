import { useState, useEffect } from "react";
import {
  getDocuments,
  type DocumentSummary,
} from "@/lib/api/legalBackend";
import { useToast } from "@/hooks/use-toast";

export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchDocuments() {
      try {
        setLoading(true);
        setError(null);
        const data = await getDocuments();
        setDocuments(data);
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error("Failed to fetch documents");
        setError(error);
        console.error("Error fetching documents:", error);
        toast({
          title: "Error",
          description:
            "Failed to load analyzed documents from the AI backend. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchDocuments();
  }, [toast]);

  const refetch = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDocuments();
      setDocuments(data);
    } catch (err) {
      const error =
        err instanceof Error ? err : new Error("Failed to fetch documents");
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { documents, loading, error, refetch };
}
