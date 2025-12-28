import { useState, useEffect } from "react";
import { getDashboardStats, type DashboardStats } from "@/lib/api/stats";
import { useToast } from "@/hooks/use-toast";

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    totalDocuments: 0,
    highRiskCount: 0,
    safeCount: 0,
    analyzingCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true);
        setError(null);
        const data = await getDashboardStats();
        setStats(data);
      } catch (err) {
        const error = err instanceof Error ? err : new Error("Failed to fetch stats");
        setError(error);
        console.error("Error fetching stats:", error);
        // Don't show toast for stats errors - they're not critical
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [toast]);

  const refetch = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      const error = err instanceof Error ? err : new Error("Failed to fetch stats");
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { stats, loading, error, refetch };
}

