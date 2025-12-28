import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout, PageHeader } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Upload, 
  FileText, 
  X, 
  CheckCircle,
  AlertCircle,
  File
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  uploadDocument,
  getJobStatus,
  type JobStatusResponse,
} from "@/lib/api/legalBackend";

interface UploadFile {
  id: string;
  file: File;
  progress: number;
  status: "pending" | "uploading" | "processing" | "complete" | "error";
  error?: string;
  jobId?: string;
  jobStatus?: JobStatusResponse;
}

const SUPPORTED_FORMATS = [".pdf"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const UploadDocument = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  // Poll job status every 2 seconds while processing
  useEffect(() => {
    if (!activeJobId) return;

    let isCancelled = false;

    const poll = async () => {
      try {
        const status = await getJobStatus(activeJobId);

        if (isCancelled) return;

        setFiles((prev) =>
          prev.map((f) =>
            f.jobId === activeJobId
              ? {
                  ...f,
                  progress: status.progress ?? f.progress,
                  status:
                    status.status === "completed"
                      ? "complete"
                      : status.status === "failed"
                      ? "error"
                      : "processing",
                  jobStatus: status,
                }
              : f,
          ),
        );

        if (status.status === "completed" && status.result?.document_id) {
          toast({
            title: "Analysis complete",
            description: "Opening interactive analysis and chat.",
          });
          setActiveJobId(null);
          navigate(`/chat/${status.result.document_id}`);
          return;
        }

        if (status.status === "failed") {
          toast({
            title: "Analysis failed",
            description: status.error || "An error occurred during analysis.",
            variant: "destructive",
          });
          setActiveJobId(null);
          return;
        }

        setTimeout(poll, 2000);
      } catch (error: any) {
        if (isCancelled) return;
        toast({
          title: "Error",
          description:
            error?.message || "Failed to fetch analysis status. Retrying...",
          variant: "destructive",
        });
        setTimeout(poll, 4000);
      }
    };

    poll();

    return () => {
      isCancelled = true;
    };
  }, [activeJobId, navigate, toast]);

  const validateFile = (file: File): string | null => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (!SUPPORTED_FORMATS.includes(ext)) {
      return `Unsupported format. Please use ${SUPPORTED_FORMATS.join(", ")}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return "File too large. Maximum size is 20MB";
    }
    return null;
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const uploadFiles: UploadFile[] = fileArray.map(file => {
      const error = validateFile(file);
      return {
        id: `${Date.now()}-${file.name}`,
        file,
        progress: 0,
        status: error ? "error" : "pending",
        error,
      };
    });
    setFiles(prev => [...prev, ...uploadFiles]);
  }, []);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      addFiles(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(e.target.files);
    }
  };

  const uploadFileToSupabase = async (uploadFile: UploadFile) => {
    // Update status to uploading
    setFiles(prev => prev.map(f => 
      f.id === uploadFile.id ? { ...f, status: "uploading", progress: 0 } : f
    ));

    try {
      const response = await uploadDocument(uploadFile.file, user?.id);

      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { 
              ...f, 
              status: "processing", 
              progress: 5,
              jobId: response.job_id,
            } 
          : f
      ));

      setActiveJobId(response.job_id);

      return { success: true, jobId: response.job_id };
    } catch (error: any) {
      setFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: "error", error: error.message || "Upload failed" } 
          : f
      ));
      throw error;
    }
  };

  const handleUpload = async () => {
    const pendingFiles = files.filter(f => f.status === "pending");
    if (pendingFiles.length === 0) {
      toast({
        title: "No files to upload",
        description: "Please add files to upload",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      // Only support single-file upload for analysis pipeline
      const file = pendingFiles[0];
          await uploadFileToSupabase(file);

        toast({
        title: "Upload successful",
        description:
          "Document uploaded. AI analysis has started and may take a moment.",
        });
    } catch (error: any) {
      toast({
        title: "Upload error",
        description: error.message || "An error occurred during upload",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const pendingCount = files.filter(f => f.status === "pending").length;
  const hasErrors = files.some(f => f.status === "error");
  const activeFile = files.find(f => f.jobId === activeJobId) || files[0];
  const stage = activeFile?.jobStatus?.stage;

  const getStageIndex = () => {
    if (!stage) return 0;
    switch (stage) {
      case "Extracting text from PDF":
        return 1;
      case "Detecting risks with AI model":
        return 2;
      case "Generating legal advisory":
        return 3;
      case "Analysis complete":
        return 4;
      default:
        return 0;
    }
  };

  const currentStage = getStageIndex();

  return (
    <Layout showNavigation={false}>
      <div className="px-4 pb-8">
        <PageHeader
          title="Upload Document"
          subtitle="Add documents for AI analysis"
          action={
            <Button variant="ghost" onClick={() => navigate(-1)}>
              Cancel
            </Button>
          }
        />

        {/* Drop Zone */}
        <Card
          variant="glass"
          className={cn(
            "border-2 border-dashed transition-all duration-200",
            isDragging ? "border-primary bg-primary/5" : "border-border/50",
            "cursor-pointer"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <CardContent className="py-12 text-center">
            <div className={cn(
              "p-4 rounded-full w-fit mx-auto mb-4 transition-colors",
              isDragging ? "bg-primary/20" : "bg-primary/10"
            )}>
              <Upload className={cn(
                "h-10 w-10",
                isDragging ? "text-primary" : "text-muted-foreground"
              )} />
            </div>
            <h3 className="font-display font-bold mb-2">
              {isDragging ? "Drop files here" : "Drag & drop files"}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              or click to browse
            </p>
            <p className="text-xs text-muted-foreground">
              Supported: {SUPPORTED_FORMATS.join(", ")} (max 20MB)
            </p>
          </CardContent>
        </Card>

        <input
          id="file-input"
          type="file"
          accept={SUPPORTED_FORMATS.join(",")}
          multiple
          className="hidden"
          onChange={handleFileSelect}
        />

        {/* File & Analysis Status */}
        {files.length > 0 && activeFile && (
          <div className="mt-6 space-y-4">
            <h3 className="font-display font-bold text-sm">Analysis progress</h3>
            
            <Card variant="glass">
              <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "p-2 rounded-lg",
                      activeFile.status === "error"
                        ? "bg-destructive/10"
                        : "bg-primary/10",
                    )}
                  >
                    {activeFile.status === "complete" ? (
                        <CheckCircle className="h-5 w-5 text-success" />
                    ) : activeFile.status === "error" ? (
                        <AlertCircle className="h-5 w-5 text-destructive" />
                      ) : (
                        <FileText className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                      {activeFile.file.name}
                      </p>
                        <p className="text-xs text-muted-foreground">
                      {(activeFile.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                  </div>
                    </div>

                <div className="space-y-2">
                  <Progress
                    value={activeFile.progress}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    {stage ?? "Waiting for analysis to start..."}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* 4-step visual */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              {[
                { label: "Uploading", index: 0 },
                { label: "Extracting", index: 1 },
                { label: "Analyzing", index: 2 },
                { label: "Generating", index: 3 },
              ].map((step) => {
                const completed = currentStage > step.index + 1;
                const active = currentStage === step.index + 1;
                return (
                  <div
                    key={step.label}
                    className={cn(
                      "flex flex-col items-center gap-1 p-2 rounded-lg border",
                      completed
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-500"
                        : active
                        ? "bg-primary/10 border-primary/40 text-primary"
                        : "bg-muted/40 border-border/60 text-muted-foreground",
                    )}
                  >
                    {completed ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : active ? (
                      <File className="h-4 w-4" />
                    ) : (
                      <FileText className="h-4 w-4" />
                    )}
                    <span>{step.label}</span>
                  </div>
                );
              })}
            </div>

            {activeFile.status === "complete" && activeFile.jobId && (
              <div className="flex gap-3">
                <Button
                  variant="gradient"
                  className="flex-1"
                  onClick={() => navigate(`/chat/${activeFile.jobId}`)}
                >
                  View Analysis & Chat
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Upload Button */}
        <div className="mt-6 flex gap-3">
          <Button 
            variant="glass" 
            className="flex-1"
            onClick={() => navigate(-1)}
          >
            Cancel
          </Button>
          <Button 
            variant="gradient" 
            className="flex-1"
            onClick={handleUpload}
            disabled={pendingCount === 0 || hasErrors || uploading}
            loading={uploading}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload {pendingCount > 0 && `(${pendingCount})`}
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default UploadDocument;