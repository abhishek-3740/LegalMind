import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  FileText, 
  Download, 
  Share2, 
  MessageCircle,
  AlertTriangle,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface Finding {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  section: string;
}

interface DocumentData {
  id: string;
  title: string;
  uploadedAt: string;
  status: "safe" | "high-risk" | "analyzing";
  riskScore: number;
  findings: Finding[];
  recommendations: string[];
}

// Mock document data - will be replaced with real data from Supabase
const mockDocument: DocumentData = {
  id: "1",
  title: "Service Agreement - Acme Corp",
  uploadedAt: "Dec 15, 2024",
  status: "high-risk",
  riskScore: 78,
  findings: [
    { 
      id: "1", 
      severity: "high" as const, 
      title: "Non-compete clause too broad", 
      description: "The non-compete clause spans 5 years and covers all industries, which may be unenforceable.",
      section: "Section 12.1"
    },
    { 
      id: "2", 
      severity: "high" as const, 
      title: "Unlimited liability exposure", 
      description: "No cap on liability for breaches, exposing your company to significant financial risk.",
      section: "Section 8.3"
    },
    { 
      id: "3", 
      severity: "medium" as const, 
      title: "Ambiguous termination terms", 
      description: "Termination clause lacks clarity on notice period and grounds for termination.",
      section: "Section 15.2"
    },
    { 
      id: "4", 
      severity: "low" as const, 
      title: "Missing jurisdiction clause", 
      description: "No specific jurisdiction mentioned for dispute resolution.",
      section: "Section 18"
    },
  ],
  recommendations: [
    "Negotiate a shorter non-compete period (1-2 years) and limit geographic scope",
    "Add a liability cap (typically 12-24 months of contract value)",
    "Clarify termination notice period (30-60 days recommended)",
    "Specify jurisdiction for dispute resolution"
  ]
};

const severityConfig = {
  high: { 
    color: "text-destructive", 
    bg: "bg-destructive/10", 
    icon: AlertTriangle,
    label: "High Risk"
  },
  medium: { 
    color: "text-warning", 
    bg: "bg-warning/10", 
    icon: AlertCircle,
    label: "Medium Risk"
  },
  low: { 
    color: "text-muted-foreground", 
    bg: "bg-muted/50", 
    icon: Clock,
    label: "Low Risk"
  }
};

const DocumentAnalysis = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);

  // In real app, fetch document by id
  const document = mockDocument;
  
  const getRiskColor = (score: number) => {
    if (score >= 70) return "text-destructive";
    if (score >= 40) return "text-warning";
    return "text-success";
  };

  const getRiskLabel = (score: number) => {
    if (score >= 70) return "High Risk";
    if (score >= 40) return "Medium Risk";
    return "Low Risk";
  };

  const handleDownload = async () => {
    try {
      setDownloadLoading(true);
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
      const response = await fetch(`${API_BASE_URL}/api/v1/report/${id}`);
      
      if (!response.ok) {
        throw new Error("Failed to download report");
      }
      
      const data = await response.json();
      const reportContent = data.report;
      
      // Create blob and download
      const blob = new Blob([reportContent], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${document.title.replace(/\s+/g, "_")}_report.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast({
        title: "Report downloaded",
        description: "Your analysis report has been downloaded successfully.",
      });
    } catch (error) {
      console.error("Download error:", error);
      toast({
        title: "Download failed",
        description: "Could not download the report. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      setShareLoading(true);
      
      // Check if Web Share API is available
      if (navigator.share) {
        await navigator.share({
          title: `Legal Analysis: ${document.title}`,
          text: `Risk Score: ${document.riskScore}% - ${getRiskLabel(document.riskScore)}`,
          url: window.location.href,
        });
        toast({
          title: "Shared",
          description: "Document link shared successfully.",
        });
      } else {
        // Fallback: Copy to clipboard
        const text = `${document.title}\nRisk Score: ${document.riskScore}%\n${window.location.href}`;
        await navigator.clipboard.writeText(text);
        toast({
          title: "Copied to clipboard",
          description: "Document information copied to your clipboard.",
        });
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Share error:", error);
        toast({
          title: "Share failed",
          description: "Could not share the document.",
          variant: "destructive",
        });
      }
    } finally {
      setShareLoading(false);
    }
  };

  const handleChat = () => {
    navigate(`/document/${id}/chat`);
  };

  return (
    <Layout showNavigation={false}>
      <div className="pb-8">
        {/* Header */}
        <header className="px-4 py-4 safe-top glass border-b border-border/30 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl hover:bg-card/80 transition-colors touch-target"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-display font-bold truncate">{document.title}</h1>
              <p className="text-xs text-muted-foreground">Uploaded {document.uploadedAt}</p>
            </div>
          </div>
        </header>

        <div className="px-4 pt-6 space-y-6">
          {/* Document Preview Card */}
          <Card variant="glass">
            <CardContent className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-4 rounded-xl bg-primary/10">
                  <FileText className="h-10 w-10 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={document.status === "safe" ? "safe" : "high-risk"}>
                      {document.status === "safe" ? "Safe" : "High Risk"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {document.findings.length} findings detected
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button 
                  variant="glass" 
                  size="sm" 
                  className="flex-1"
                  onClick={handleDownload}
                  disabled={downloadLoading}
                >
                  {downloadLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {downloadLoading ? "Downloading..." : "Download"}
                </Button>
                <Button 
                  variant="glass" 
                  size="sm" 
                  className="flex-1"
                  onClick={handleShare}
                  disabled={shareLoading}
                >
                  {shareLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Share2 className="h-4 w-4 mr-2" />
                  )}
                  {shareLoading ? "Sharing..." : "Share"}
                </Button>
                <Button 
                  variant="gradient" 
                  size="sm" 
                  className="flex-1"
                  onClick={handleChat}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Chat
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Risk Score */}
          <Card variant="glass">
            <CardHeader className="pb-2">
              <h2 className="font-display font-bold text-lg">Risk Assessment</h2>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Overall Risk Score</span>
                <span className={cn("text-3xl font-bold font-display", getRiskColor(document.riskScore))}>
                  {document.riskScore}%
                </span>
              </div>
              <Progress 
                value={document.riskScore} 
                className="h-3"
              />
              <div className="flex items-center justify-between text-sm">
                <span className="text-success">Low Risk</span>
                <span className="text-warning">Medium</span>
                <span className="text-destructive">High Risk</span>
              </div>

              {/* Risk Breakdown */}
              <div className="pt-4 border-t border-border/30">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-2xl font-bold text-destructive">
                      {document.findings.filter(f => f.severity === "high").length}
                    </p>
                    <p className="text-xs text-muted-foreground">High</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-warning">
                      {document.findings.filter(f => f.severity === "medium").length}
                    </p>
                    <p className="text-xs text-muted-foreground">Medium</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-muted-foreground">
                      {document.findings.filter(f => f.severity === "low").length}
                    </p>
                    <p className="text-xs text-muted-foreground">Low</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Findings */}
          <Card variant="glass">
            <CardHeader className="pb-2">
              <h2 className="font-display font-bold text-lg">Key Findings</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {document.findings.map((finding) => {
                const config = severityConfig[finding.severity];
                const Icon = config.icon;
                return (
                  <div 
                    key={finding.id}
                    className={cn(
                      "p-4 rounded-xl border border-border/30",
                      config.bg
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded-lg", config.bg)}>
                        <Icon className={cn("h-4 w-4", config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm">{finding.title}</p>
                          <Badge variant="glass" className="text-xs">
                            {finding.section}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {finding.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card variant="glass">
            <CardHeader className="pb-2">
              <h2 className="font-display font-bold text-lg">Recommendations</h2>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {document.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="p-1 rounded-full bg-success/20 mt-0.5">
                      <CheckCircle className="h-4 w-4 text-success" />
                    </div>
                    <span className="text-sm">{rec}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default DocumentAnalysis;