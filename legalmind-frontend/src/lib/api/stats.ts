import { getDocuments } from "@/lib/api/legalBackend";

export interface DashboardStats {
  totalDocuments: number;
  highRiskCount: number;
  safeCount: number;
  analyzingCount: number;
  averageRiskPercentage: number;
  averageSafePercentage: number;
}

/**
 * Get dashboard statistics based on FastAPI analysis backend
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const docs = await getDocuments();

  // Calculate completed documents for percentage calculations
  const completedDocs = docs.filter((d) => d.status === "completed");
  
  // Calculate average risk and safe percentages from completed documents
  let totalRiskScore = 0;
  let totalSafeScore = 0;
  
  if (completedDocs.length > 0) {
    completedDocs.forEach((doc) => {
      const riskScore = doc.risk_score ?? 0;
      totalRiskScore += riskScore;
      totalSafeScore += (100 - riskScore);
    });
  }

  const averageRiskPercentage = completedDocs.length > 0 
    ? Math.round(totalRiskScore / completedDocs.length)
    : 0;
    
  const averageSafePercentage = completedDocs.length > 0
    ? Math.round(totalSafeScore / completedDocs.length)
    : 0;

  const stats: DashboardStats = {
    totalDocuments: docs.length,
    highRiskCount: completedDocs.filter((d) => (d.risk_score ?? 0) > 70).length,
    safeCount: completedDocs.filter((d) => (d.risk_score ?? 0) < 40).length,
    analyzingCount: docs.filter((d) => d.status !== "completed").length,
    averageRiskPercentage,
    averageSafePercentage,
  };

  return stats;
}
