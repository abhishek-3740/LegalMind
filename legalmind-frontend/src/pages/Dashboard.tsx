import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { DocumentCard, type Document } from "@/components/document/DocumentCard";
import {
  FileText,
  AlertTriangle,
  ShieldCheck,
  Search,
  Bell,
  Plus,
  LogOut,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useDocuments } from "@/hooks/useDocuments";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { formatDistanceToNow } from "date-fns";
import type { DocumentSummary } from "@/lib/api/legalBackend";

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { documents, loading: documentsLoading } = useDocuments();
  const { stats, loading: statsLoading } = useDashboardStats();

  const handleSignOut = async () => {
    await signOut();
    toast({
      title: "Signed out",
      description: "You have been signed out successfully.",
    });
  };

  const handleDocumentClick = (docId: string) => {
    navigate(`/document/${docId}`);
  };

  const handleUpload = () => {
    navigate("/upload");
  };

  const userName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "User";

  const mapStatus = (doc: DocumentSummary): Document["status"] => {
    const score = doc.risk_score ?? 0;
    if (doc.status !== "completed") return "analyzing";
    if (score > 70) return "high-risk";
    if (score < 40) return "safe";
    return "analyzing";
  };

  // Convert backend documents to component format
  const recentDocuments: Document[] = useMemo(
    () =>
      documents.slice(0, 3).map((doc) => ({
        id: doc.document_id,
        title: doc.file_name,
        updatedAt: formatDistanceToNow(new Date(doc.upload_date), {
          addSuffix: true,
        }),
        status: mapStatus(doc),
        riskScore: doc.risk_score ?? undefined,
      })),
    [documents],
  );

  return (
    <Layout>
      <div className="px-4 pb-8">
        {/* Header */}
        <PageHeader
          title={`Welcome, ${userName}`}
          subtitle="Your legal documents at a glance"
          action={
            <div className="flex items-center gap-2">
              <button
                className="p-2 rounded-xl glass hover:bg-card/80 transition-colors touch-target relative"
                onClick={() => navigate('/notifications')}
              >
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
        {statsLoading ? (
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center justify-center h-24 bg-card/50 rounded-xl">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 mb-8">
            <StatsCard
              icon={FileText}
              value={stats.totalDocuments}
              label="Contracts"
            />
            <StatsCard
              icon={AlertTriangle}
              value={`${stats.averageRiskPercentage}%`}
              label="Risk"
              variant="danger"
            />
            <StatsCard
              icon={ShieldCheck}
              value={`${stats.averageSafePercentage}%`}
              label="Safe"
              variant="success"
            />
          </div>
        )}

        {/* Recent Documents */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold">Recent Documents</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/documents')}
            >
              View All
            </Button>
          </div>

          {documentsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {recentDocuments.map((doc) => (
                  <DocumentCard
                    key={doc.id}
                    document={doc}
                    onClick={() => handleDocumentClick(doc.id)}
                  />
                ))}
              </div>

              {recentDocuments.length === 0 && (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">No documents yet</p>
                  <p className="text-sm text-muted-foreground/70">Upload your first document to get started</p>
                  <Button variant="gradient" className="mt-4" onClick={handleUpload}>
                    <Plus className="h-4 w-4 mr-2" />
                    Upload Document
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      <button
        className="fixed bottom-24 right-4 h-14 w-14 rounded-full bg-gradient-primary shadow-glow flex items-center justify-center text-primary-foreground hover:scale-105 transition-transform touch-target z-40"
        onClick={handleUpload}
      >
        <Plus className="h-6 w-6" />
      </button>
    </Layout>
  );
};

export default Dashboard;