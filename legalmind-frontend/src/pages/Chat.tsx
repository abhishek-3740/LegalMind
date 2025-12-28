import { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  ArrowLeft, 
  Send, 
  Sparkles, 
  User,
  FileText,
  Loader2,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  getDocumentDetails,
  getReport,
  chatWithDocument,
  chatWithBot,
  getChatbotSuggestions,
  saveChatHistory,
  getChatHistory,
  deleteChatHistory,
  checkDocumentExists,
  type ChatHistoryItem,
} from "@/lib/api/legalBackend";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isReport?: boolean;
}

// Deduplicate messages by content to prevent duplicates
const deduplicateMessages = (messages: Message[]): Message[] => {
  const seen = new Map<string, boolean>();
  return messages.filter((msg) => {
    const key = `${msg.role}::${msg.content.slice(0, 100)}`; // Use role + content hash
    if (seen.has(key)) {
      return false; // Skip duplicate
    }
    seen.set(key, true);
    return true; // Keep first occurrence
  });
};

const Chat = () => {
  const { documentId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [downloadingReport, setDownloadingReport] = useState(false);
  const [documentName, setDocumentName] = useState<string>("");
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [riskyClauses, setRiskyClauses] = useState<number | null>(null);
  const [totalChunks, setTotalChunks] = useState<number | null>(null);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load document details, report, and any saved chat history from Supabase
  useEffect(() => {
    if (!documentId) {
      setLoadingInitial(false);
      // Load general suggestions
      getChatbotSuggestions()
        .then(setSuggestedQuestions)
        .catch(() => {
          setSuggestedQuestions([
            "What are the key risks in this contract?",
            "Explain the liability clause",
            "Is the termination clause fair?",
            "What should I negotiate?",
          ]);
        });
      return;
    }

    const load = async () => {
      try {
        setLoadingInitial(true);

        // ✅ SAFETY CHECK: Verify document still exists before loading
        const exists = await checkDocumentExists(documentId);
        if (!exists) {
          toast({
            title: "Document Not Found",
            description: "This document no longer exists or has been deleted. Redirecting to documents...",
            variant: "destructive",
          });
          navigate("/documents");
          return;
        }

        // Helper function to retry getting report (in case of race condition)
        const getReportWithRetry = async (maxRetries = 3) => {
          let lastError: any;
          for (let i = 0; i < maxRetries; i++) {
            try {
              return await getReport(documentId);
            } catch (error) {
              lastError = error;
              if (i < maxRetries - 1) {
                // Wait before retrying (exponential backoff: 500ms, 1000ms, 1500ms)
                await new Promise(resolve => setTimeout(resolve, (i + 1) * 500));
              }
            }
          }
          throw lastError;
        };

        let reportRes: any = null;
        try {
          reportRes = await getReportWithRetry();
        } catch (error) {
          console.warn("Could not load report, will show placeholder:", error);
          reportRes = { report: "Report is being generated. Please try again in a moment." };
        }

        const [details, suggestions] = await Promise.all([
          getDocumentDetails(documentId),
          getChatbotSuggestions(documentId),
        ]);

        setDocumentName(details.file_name);
        setRiskScore(details.risk_score);
        setRiskyClauses(details.risky_chunks);
        setTotalChunks(details.total_chunks);
        setSuggestedQuestions(suggestions);

        const baseMessages: Message[] = [];

        // Report as first assistant message
        baseMessages.push({
          id: `report-${documentId}`,
          role: "assistant",
          content: reportRes?.report || "Analysis report is being prepared...",
          timestamp: new Date().toISOString(),
          isReport: true,
        });

        // Summary as second assistant message
        const riskLevel =
          details.risk_score > 70
            ? "high"
            : details.risk_score >= 40
            ? "medium"
            : "low";

        const summary = `I've analyzed your contract "${details.file_name}" and found ${details.risky_chunks} risky clauses out of ${details.total_chunks} sections. Overall risk score: ${details.risk_score}%. This looks like a **${riskLevel.toUpperCase()}** risk agreement. Ask me anything about specific clauses, negotiation levers, or implications.`;

        baseMessages.push({
          id: `summary-${documentId}`,
          role: "assistant",
          content: summary,
          timestamp: new Date().toISOString(),
        });

        console.log("[Chat] Setting base messages:", baseMessages.length, baseMessages);

        // Try to load chat history from Supabase (if user is logged in)
        let hasLoadedHistory = false;
        try {
          if (user?.id) {
            const supabaseHistory = await getChatHistory(user.id, documentId);
            if (supabaseHistory && supabaseHistory.length > 0) {
              // Filter out any duplicate summary messages from stored history
              const convertedHistory: Message[] = supabaseHistory
                .filter((msg) => !msg.content.includes("I've analyzed your contract"))
                .map((msg, idx) => ({
                  id: `chat-${idx}-${documentId}`,
                  role: msg.role,
                  content: msg.content,
                  timestamp: new Date().toISOString(),
                }));
              console.log("[Chat] Setting messages with history:", baseMessages.length + convertedHistory.length);
              setMessages([...baseMessages, ...convertedHistory]);
              hasLoadedHistory = true;
              setLoadingInitial(false);
              return;
            }
          }
        } catch (e) {
          console.warn("[Chat] getChatHistory failed, trying localStorage:", e);
        }

        // Fallback to localStorage
        const storageKey = `chat_${documentId}`;
        const stored = localStorage.getItem(storageKey);
        if (stored && !hasLoadedHistory) {
          try {
            const parsed: Message[] = JSON.parse(stored);
            const localHistory = parsed
              .filter((m) => !m.isReport && !m.content.includes("I've analyzed your contract"))
              .map((m, idx) => ({
                ...m,
                id: `local-${idx}-${documentId}`,
              }));
            console.log("[Chat] Setting messages with localStorage history:", baseMessages.length + localHistory.length);
            setMessages([...baseMessages, ...localHistory]);
          } catch {
            console.log("[Chat] Setting only base messages (localStorage parse failed)");
            setMessages(baseMessages);
          }
        } else if (!hasLoadedHistory) {
          console.log("[Chat] Setting only base messages (no history found)");
          setMessages(baseMessages);
        }
      } catch (error: any) {
        toast({
          title: "Error",
          description:
            error?.message ||
            "Failed to load document details and initial analysis.",
          variant: "destructive",
        });
      } finally {
        setLoadingInitial(false);
      }
    };

    load();
  }, [documentId, toast, user]);

  // Save chat history to Supabase (only user messages and assistant responses, not reports or summaries)
  useEffect(() => {
    if (!documentId || !user?.id || messages.length <= 2) return; // Skip if only base messages exist
    
    const saveHistory = async () => {
      try {
        // Filter out report message and summary (analysis message)
        const history = messages
          .filter((m) => 
            !m.isReport && 
            !m.content.includes("I've analyzed your contract")
          )
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));
        
        if (history.length > 0) {
          await saveChatHistory(user.id, documentId, history);
        }
      } catch (error) {
        // Silently fail and fallback to localStorage
        // Still save to localStorage as fallback
        const history = messages.filter(
          (m) => 
            !m.isReport && 
            !m.content.includes("I've analyzed your contract")
        );
        localStorage.setItem(`chat_${documentId}`, JSON.stringify(history));
      }
    };
    
    // Debounce to avoid too many requests
    const timer = setTimeout(saveHistory, 2000);
    return () => clearTimeout(timer);
  }, [documentId, user?.id, messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      let response;
      
      if (documentId) {
        // Chat about specific document
        const previousMessages = messages.filter((m) => !m.isReport);
        const chatHistory: ChatHistoryItem[] = [...previousMessages, userMessage].map(
          (m) => ({
            role: m.role,
            content: m.content,
          }),
        );

        response = await chatWithDocument(
          documentId,
          userMessage.content,
          chatHistory,
        );
      } else {
        // Chat with general assistant (chatbot)
        const chatHistory: ChatHistoryItem[] = messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));

        const botResponse = await chatWithBot(
          userMessage.content,
          chatHistory,
        );
        
        response = {
          response: botResponse.response,
          timestamp: botResponse.timestamp,
        };
      }

      const assistantMessage: Message = {
        id: `${Date.now()}_assistant`,
        role: "assistant",
        content: response.response,
        timestamp: response.timestamp,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleDownloadReport = async () => {
    if (!documentId) return;
    try {
      setDownloadingReport(true);
      const { report } = await getReport(documentId);
      const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${documentName || "analysis-report"}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error?.message || "Could not download the report.",
        variant: "destructive",
      });
    } finally {
      setDownloadingReport(false);
    }
  };

  const riskBadgeColor =
    riskScore == null
      ? "bg-muted text-muted-foreground"
      : riskScore > 70
      ? "bg-red-500/10 text-red-500 border-red-500/40"
      : riskScore >= 40
      ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/40"
      : "bg-emerald-500/10 text-emerald-500 border-emerald-500/40";

  return (
    <Layout showNavigation={!documentId}>
      <div className="flex flex-col h-[calc(100vh-5rem)]">
        {/* Header */}
        <header className="px-4 py-4 safe-top glass border-b border-border/30 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            {documentId && (
              <button 
                onClick={() => navigate(-1)}
                className="p-2 rounded-xl hover:bg-card/80 transition-colors touch-target"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <div className="flex-1 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-gradient-primary">
                <Sparkles className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                  <h1 className="font-display font-bold">Contract Assistant</h1>
                {documentId && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                      {documentName || "Loading document..."}
                  </p>
                )}
                </div>
              </div>

              {documentId && (
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
                      riskBadgeColor,
                    )}
                  >
                    Risk: {riskScore != null ? `${riskScore}%` : "--"}
                  </span>
                  {riskyClauses != null && totalChunks != null && (
                    <span className="text-[11px] text-muted-foreground">
                      Risky clauses:{" "}
                      <span className="font-medium text-foreground">
                        {riskyClauses}
                      </span>{" "}
                      / {totalChunks}
                    </span>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={handleDownloadReport}
                    disabled={downloadingReport}
                  >
                    {downloadingReport ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loadingInitial && documentId ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 && !documentId ? (
            <div className="text-center py-12">
              <div className="p-4 rounded-full bg-primary/10 w-fit mx-auto mb-4">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <h2 className="font-display text-xl font-bold mb-2">
                How can I help?
              </h2>
              <p className="text-muted-foreground text-sm mb-6">
                I can help you understand legal concepts and analyze documents.
              </p>
              
              {/* Suggested Questions */}
              <div className="flex flex-wrap justify-center gap-2">
                {suggestedQuestions.map((question, index) => (
                  <Button
                    key={index}
                    variant="glass"
                    size="sm"
                    className="text-xs"
                    onClick={() => sendMessage(question)}
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <>
          {deduplicateMessages(messages).map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3",
                    message.role === "user"
                      ? "justify-end"
                      : "justify-start",
              )}
            >
              {message.role === "assistant" && (
                <div className="p-2 rounded-xl bg-primary/10 h-fit shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
              )}
              <Card
                    variant={
                      message.role === "user"
                        ? "default"
                        : message.isReport
                        ? "default"
                        : "glass"
                    }
                className={cn(
                  "px-4 py-3",
                  message.role === "user" 
                    ? "max-w-[80%] bg-gradient-primary text-primary-foreground" 
                        : message.isReport 
                        ? "w-full bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-blue-500/30"
                        : "max-w-[80%]",
                )}
              >
                    <RichText
                      content={message.content}
                      isReport={message.isReport}
                    />
              </Card>
              {message.role === "user" && (
                <div className="p-2 rounded-xl bg-muted h-fit shrink-0">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}
            </>
          )}

          {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-3 justify-start">
              <div className="p-2 rounded-xl bg-primary/10 h-fit">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <Card variant="glass" className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">
                    Thinking...
                  </span>
                </div>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-4 py-4 glass border-t border-border/30 safe-bottom">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about this contract..."
              disabled={isLoading || loadingInitial}
              className="flex-1 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            />
            <Button 
              type="submit" 
              variant="gradient" 
              size="icon"
              disabled={!input.trim() || isLoading || loadingInitial}
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </Layout>
  );
};

interface RichTextProps {
  content: string;
  isReport?: boolean;
}

function RichText({ content, isReport }: RichTextProps) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let codeBuffer: string[] = [];
  let inCode = false;

  const flushCode = (key: string) => {
    if (!codeBuffer.length) return null;
    const block = (
      <pre
        key={key}
        className={cn(
          "rounded-md bg-black/40 px-3 py-2 overflow-x-auto text-xs border border-border/40 my-2",
          isReport && "bg-black/60",
        )}
      >
        <code className="text-gray-200">{codeBuffer.join("\n")}</code>
      </pre>
    );
    codeBuffer = [];
    return block;
  };

  const formatInline = (text: string) => {
    // Handle bold text **text** and italic *text*
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={idx} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("*") && part.endsWith("*") && !part.startsWith("**")) {
        return (
          <em key={idx} className="italic">
            {part.slice(1, -1)}
          </em>
        );
      }
      return <span key={idx}>{part}</span>;
    });
  };

  let consecutiveEmptyLines = 0;

  lines.forEach((line, idx) => {
    const key = `l-${idx}`;
    
    if (line.trim().startsWith("```")) {
      if (inCode) {
        // closing fence
        const block = flushCode(key);
        if (block) elements.push(block);
        inCode = false;
      } else {
        inCode = true;
      }
      return;
    }

    if (inCode) {
      codeBuffer.push(line);
      return;
    }

    if (!line.trim()) {
      consecutiveEmptyLines++;
      // Only add spacer for first empty line in sequence
      if (consecutiveEmptyLines === 1) {
        elements.push(
          <div key={key} className={cn("", isReport ? "h-1.5" : "h-2.5")}>
            {/* spacer */}
          </div>,
        );
      }
      return;
    }
    
    consecutiveEmptyLines = 0;

    // H1 heading (main title)
    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={key}
          className={cn(
            "font-bold pt-4 pb-2",
            isReport 
              ? "text-base text-cyan-400 dark:text-cyan-300" 
              : "text-lg text-foreground",
          )}
        >
          {formatInline(line.slice(3))}
        </h2>,
      );
    } 
    // H2 heading (subheading)
    else if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={key}
          className={cn(
            "font-semibold pt-3 pb-1.5",
            isReport 
              ? "text-sm text-primary/90" 
              : "text-base text-foreground",
          )}
        >
          {formatInline(line.slice(4))}
        </h3>,
      );
    }
    // H3 heading (minor heading)
    else if (line.startsWith("#### ")) {
      elements.push(
        <h4
          key={key}
          className={cn(
            "font-semibold pt-2 pb-1",
            isReport 
              ? "text-xs text-muted-foreground uppercase tracking-wide" 
              : "text-sm text-foreground",
          )}
        >
          {formatInline(line.slice(5))}
        </h4>,
      );
    }
    // Horizontal rule
    else if (line.trim() === "---" || line.trim() === "***") {
      elements.push(
        <div key={key} className="my-3 border-t border-border/40" />,
      );
    }
    // Bullet list
    else if (line.startsWith("- ")) {
      elements.push(
        <div key={key} className={cn("flex text-sm gap-2", isReport && "gap-1.5")}>
          <span className={cn("shrink-0", isReport ? "text-primary/60" : "text-primary")}>▸</span>
          <span>{formatInline(line.slice(2))}</span>
        </div>,
      );
    } 
    // Numbered list
    else if (/^\d+\.\s+/.test(line)) {
      const match = line.match(/^(\d+\.)\s+(.*)$/);
      elements.push(
        <div key={key} className="flex text-sm gap-2">
          <span className="shrink-0 font-semibold text-primary/80">
            {match?.[1]}
          </span>
          <span>
            {formatInline(match?.[2] || "")}
          </span>
        </div>,
      );
    } 
    // Regular paragraph
    else {
      elements.push(
        <p 
          key={key} 
          className={cn(
            "whitespace-pre-wrap leading-relaxed",
            isReport ? "text-sm" : "text-sm",
          )}
        >
          {formatInline(line)}
        </p>,
      );
    }
  });

  // flush trailing code block if any
  if (inCode && codeBuffer.length) {
    const block = flushCode("code-final");
    if (block) elements.push(block);
  }

  return <div className={cn("space-y-1.5", isReport && "space-y-1")}>{elements}</div>;
}

export default Chat;

function getGeneralAssistantReply(question: string): string {
  const q = question.toLowerCase();

  if (q.includes("what") && (q.includes("app") || q.includes("legalmind"))) {
    return [
      "# 👋 Welcome to LegalMind",
      "",
      "LegalMind is an AI-powered contract review assistant that:",
      "- **Ingests your PDF contracts** and converts them into text and semantic chunks.",
      "- **Detects risky clauses** using a 97.74% accuracy ensemble model.",
      "- **Builds a FAISS vector database** so it can reason over the agreement.",
      "- **Generates a detailed legal-style report** explaining each major risk.",
      "- **Lets you chat** with the analyzed contract using an enhanced RAG system.",
      "",
      "You can upload a contract from the **Upload** page, watch the analysis progress, and then open an interactive chat for that specific document.",
    ].join("\n");
  }

  if (q.includes("how") && (q.includes("work") || q.includes("works") || q.includes("does"))) {
    return [
      "## 🔍 How the analysis pipeline works",
      "",
      "1. **Upload**: You upload a PDF contract from the Upload page.",
      "2. **Ingestion**: The backend extracts text, chunks it, and builds a FAISS vector index.",
      "3. **Risk detection**: An ensemble of legal-domain models scores each clause and flags risks.",
      "4. **LLM advisory**: A legal-tuned LLM writes a structured report for the risky clauses.",
      "5. **Chat**: When you open `/chat/{documentId}`, the system combines the report, risky clauses, and vector search to answer your questions.",
      "",
      `All of this runs on the FastAPI backend at ${import.meta.env.VITE_API_BASE_URL || "http://localhost:8000"}, and the React app just orchestrates the flow and displays the results.`,
      "(Check your environment configuration to see which backend is active)",
      "",
    ].join("\n");
  }

  if (q.includes("upload")) {
    return [
      "## 📄 How to upload a contract",
      "",
      "1. Go to the **Upload Document** page.",
      "2. Drag & drop or select a **PDF** file (max 20MB).",
      "3. Click **Upload** to start the analysis.",
      "4. Watch the progress steps: Uploading → Extracting → Analyzing → Generating.",
      "5. When it finishes, you'll be automatically redirected to `/chat/{documentId}` for that contract.",
    ].join("\n");
  }

  if (q.includes("risk") || q.includes("non-compete") || q.includes("non compete")) {
    return [
      "## ⚠️ About risk scoring",
      "",
      "- The system assigns a **risk score (0–100%)** based on how many risky chunks it finds.",
      "- Clauses like **non-competes, unlimited liability, harsh termination, or broad IP assignments** are treated as higher risk.",
      "- You’ll see:",
      "  - **Red** badge for high risk (> 70).",
      "  - **Yellow** for medium (40–70).",
      "  - **Green** for low risk (< 40).",
      "",
      "For deep clause-level explanations, it's best to upload a contract and use the per-document chat view.",
    ].join("\n");
  }

  return [
    "## 🤖 Helpful assistant",
    "",
    "I’m the general assistant for this app. I can:",
    "- Explain **what LegalMind does** and how the pipeline works.",
    "- Guide you on **how to upload and analyze contracts**.",
    "- Help you interpret **risk scores and findings** at a high level.",
    "",
    "For detailed clause-by-clause advice, upload a PDF and open the contract-specific chat page. ",
    "If you tell me what you're trying to do (e.g., *\"I'm reviewing an NDA\"*), I can suggest what to watch out for.",
  ].join("\n");
}