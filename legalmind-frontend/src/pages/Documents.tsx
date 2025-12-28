import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { 
  Search, 
  Plus, 
  Grid3X3, 
  List, 
  Filter, 
  SlidersHorizontal,
  ArrowUpDown,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import {
  getDocuments,
  type DocumentSummary,
} from "@/lib/api/legalBackend";

type ViewMode = "list" | "grid";
type SortOption = "date" | "name" | "risk";
type FilterOption = "all" | "safe" | "high-risk" | "analyzing";

const Documents = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("date");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");

  useEffect(() => {
    // Wait for auth to load before fetching documents
    if (authLoading) return;
    
    // If user not logged in, show empty list
    if (!user?.id) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    const fetchDocuments = async () => {
      try {
        setLoading(true);
        // getDocuments() returns only completed documents from Supabase
        // No need to validate - backend already filters status="completed"
        const data = await getDocuments();
        setDocuments(data);
      } catch (error: any) {
        toast({
          title: "Error",
          description:
            error?.message || "Failed to load documents from analysis backend.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [user?.id, authLoading, toast]);

  const handleDocumentClick = (docId: string) => {
    navigate(`/chat/${docId}`);
  };

  const handleUpload = () => {
    navigate("/upload");
  };

  // Filter and sort documents
  const filteredDocuments = documents
    .filter((doc) => {
      const matchesSearch = doc.file_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesFilter = (() => {
        if (filterBy === "all") return true;
        const score = doc.risk_score;
        if (score == null) return false;
        if (filterBy === "high-risk") return score > 70;
        if (filterBy === "safe") return score < 40;
        return doc.status !== "completed";
      })();
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.file_name.localeCompare(b.file_name);
        case "risk":
          return (b.risk_score || 0) - (a.risk_score || 0);
        default:
          // Sort by date (most recent first) using upload_date
          return (
            new Date(b.upload_date).getTime() -
            new Date(a.upload_date).getTime()
          );
      }
    });

  return (
    <Layout>
      <div className="px-4 pb-8">
        {/* Header */}
        <PageHeader
          title="Documents"
          subtitle={`${documents.length} document${
            documents.length !== 1 ? "s" : ""
          }`}
          action={
            <Button variant="gradient" size="sm" onClick={handleUpload}>
              <Plus className="h-4 w-4 mr-1" />
              Upload
            </Button>
          }
        />

        {/* Search and Filters */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                className="w-full rounded-xl border border-border/60 bg-background/60 px-9 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            placeholder="Search documents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center glass rounded-lg p-1">
              <button
                className={cn(
                  "p-2 rounded-md transition-colors",
                  viewMode === "list" && "bg-primary/20 text-primary"
                )}
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </button>
              <button
                className={cn(
                  "p-2 rounded-md transition-colors",
                  viewMode === "grid" && "bg-primary/20 text-primary"
                )}
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
            </div>

            {/* Simple sort toggle */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="glass" size="sm" className="gap-2">
                  <ArrowUpDown className="h-4 w-4" />
                  Sort
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="glass">
                <button
                  className="block w-full px-3 py-1 text-left text-sm hover:bg-muted rounded-md"
                  onClick={() => setSortBy("date")}
                >
                  Date Updated
                </button>
                <button
                  className="block w-full px-3 py-1 text-left text-sm hover:bg-muted rounded-md"
                  onClick={() => setSortBy("name")}
                >
                  Name
                </button>
                <button
                  className="block w-full px-3 py-1 text-left text-sm hover:bg-muted rounded-md"
                  onClick={() => setSortBy("risk")}
                >
                  Risk Level
                </button>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Documents */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredDocuments.length > 0 ? (
          <>
            {viewMode === "list" ? (
              <div className="space-y-3">
                {filteredDocuments.map((doc) => {
                  const riskScore = doc.risk_score ?? 0;
                  const risky = doc.risky_chunks ?? 0;
                  const total = doc.total_chunks ?? 0;
                  const uploaded = formatDistanceToNow(
                    new Date(doc.upload_date),
                    { addSuffix: true },
                  );

                  const riskColor =
                    riskScore > 70
                      ? "bg-red-500/10 text-red-500 border-red-500/40"
                      : riskScore >= 40
                      ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/40"
                      : "bg-emerald-500/10 text-emerald-500 border-emerald-500/40";

                  return (
                    <Card
                      key={doc.document_id}
                      variant="glass"
                      className="cursor-pointer hover:border-primary/40 transition-colors"
                      onClick={() => handleDocumentClick(doc.document_id)}
                    >
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-sm truncate">
                              {doc.file_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Uploaded {uploaded}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                              riskColor,
                            )}
                          >
                            Risk {riskScore}%
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>
                            Risky clauses:{" "}
                            <span className="font-medium text-foreground">
                              {risky}
                            </span>
                            {total > 0 && ` / ${total}`}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[11px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDocumentClick(doc.document_id);
                            }}
                          >
                            Open Chat
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredDocuments.map((doc) => {
                  const riskScore = doc.risk_score ?? 0;
                  const risky = doc.risky_chunks ?? 0;
                  const total = doc.total_chunks ?? 0;

                  const riskColor =
                    riskScore > 70
                      ? "bg-red-500/10 text-red-500 border-red-500/40"
                      : riskScore >= 40
                      ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/40"
                      : "bg-emerald-500/10 text-emerald-500 border-emerald-500/40";

                  return (
                    <Card
                      key={doc.document_id}
                      variant="glass"
                      className="cursor-pointer hover:border-primary/40 transition-colors"
                      onClick={() => handleDocumentClick(doc.document_id)}
                    >
                      <CardContent className="p-3 space-y-2">
                        <p className="font-medium text-xs truncate">
                          {doc.file_name}
                        </p>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium",
                            riskColor,
                          )}
                        >
                          {riskScore}% risk
                        </span>
                        <p className="text-[11px] text-muted-foreground">
                          {risky} risky of {total} clauses
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-12">
            <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No documents found</p>
            <p className="text-sm text-muted-foreground/70 mb-4">
              Upload a contract to start AI analysis.
            </p>
            <Button variant="gradient" size="sm" onClick={handleUpload}>
              <Plus className="h-4 w-4 mr-1" />
              Upload your first document
            </Button>
          </div>
        )}
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

export default Documents;