// Use env override if provided; fallback to local FastAPI (default 8000 in logs)
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Helper to get auth headers with current user token
async function getAuthHeaders(): Promise<Record<string, string>> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.access_token) {
      return {
        "Authorization": `Bearer ${session.access_token}`,
      };
    }
  } catch (error) {
    console.error("Failed to get auth headers:", error);
  }
  
  return {};
}

export interface UploadResponse {
  job_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  message: string;
}

export interface JobResult {
  document_id: string;
  file_name: string;
  upload_date: string;
  status: "completed" | "failed" | string;
  risk_score: number;
  total_chunks: number;
  risky_chunks: number;
  safe_chunks: number;
  vector_db_path: string;
  report_path: string;
  risky_file: string;
  safe_file: string;
}

export interface JobStatusResponse {
  job_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress: number;
  stage: string;
  result: JobResult | null;
  error: string | null;
}

export interface DocumentSummary extends JobResult {
  id: string;
  document_id: string;
}

export interface DocumentsResponse {
  documents: DocumentSummary[];
}

export interface Finding {
  id: number;
  type: string;
  severity: "high" | "medium" | "low" | string;
  clause: string;
  confidence: number;
}

export interface DocumentDetails extends JobResult {
  findings: Finding[];
}

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  document_id: string;
  message: string;
  chat_history: ChatHistoryItem[];
}

export interface ChatResponse {
  response: string;
  timestamp: string;
}

export interface ReportResponse {
  report: string;
}

export interface ChatbotResponse {
  response: string;
  timestamp: string;
  suggestions?: string[];
}

export interface ChatbotRequest {
  message: string;
  chat_history?: ChatHistoryItem[];
  document_id?: string;
}

export interface ChatbotHealthResponse {
  status: "healthy" | "unhealthy";
  model?: string;
  ready: boolean;
  error?: string;
}

export interface ChatbotSuggestionsResponse {
  suggestions: string[];
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (typeof data?.error === "string") {
        message = data.error;
      } else if (typeof data?.message === "string") {
        message = data.message;
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

export async function uploadDocument(file: File, userId?: string): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const headers = await getAuthHeaders();
  if (userId) {
    headers["user-id"] = userId;
  }

  const response = await fetch(`${API_BASE_URL}/api/v1/upload`, {
    method: "POST",
    headers,
    body: formData,
  });

  return handleResponse<UploadResponse>(response);
}

export async function getJobStatus(jobId: string): Promise<JobStatusResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/job/${jobId}`, {
    headers,
  });
  return handleResponse<JobStatusResponse>(response);
}

export async function getDocuments(): Promise<DocumentSummary[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/documents`, {
    headers,
  });
  const data = await handleResponse<DocumentsResponse>(response);
  return data.documents ?? [];
}

export async function getDocumentDetails(
  documentId: string
): Promise<DocumentDetails> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/document/${documentId}`, {
    headers,
  });
  return handleResponse<DocumentDetails>(response);
}

export async function checkDocumentExists(
  documentId: string
): Promise<boolean> {
  /**
   * Verify if document still exists and belongs to current user
   * Returns false if: document deleted, not found, or user unauthorized
   */
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${API_BASE_URL}/api/v1/document-exists/${documentId}`,
      { headers }
    );
    const data = await handleResponse<{ exists: boolean; message: string }>(response);
    return data.exists ?? false;
  } catch (error) {
    console.error("Error checking document existence:", error);
    return false; // Assume deleted if verification fails
  }
}

export async function chatWithDocument(
  documentId: string,
  message: string,
  chatHistory: ChatHistoryItem[]
): Promise<ChatResponse> {
  const body: ChatRequest = {
    document_id: documentId,
    message,
    chat_history: chatHistory,
  };

  const headers = await getAuthHeaders();
  headers["Content-Type"] = "application/json";

  const response = await fetch(`${API_BASE_URL}/api/v1/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  return handleResponse<ChatResponse>(response);
}

export async function getReport(documentId: string): Promise<ReportResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/report/${documentId}`, {
    headers,
  });
  return handleResponse<ReportResponse>(response);
}

// ============================================================================
// CHATBOT API FUNCTIONS
// ============================================================================

export async function chatWithBot(
  message: string,
  chatHistory?: ChatHistoryItem[],
  documentId?: string
): Promise<ChatbotResponse> {
  const body: ChatbotRequest = {
    message,
    chat_history: chatHistory,
    document_id: documentId,
  };

  const headers = await getAuthHeaders();
  headers["Content-Type"] = "application/json";

  const response = await fetch(`${API_BASE_URL}/api/v1/chatbot`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  return handleResponse<ChatbotResponse>(response);
}

export async function getChatbotSuggestions(
  documentId?: string
): Promise<string[]> {
  const url = new URL(`${API_BASE_URL}/api/v1/chatbot/suggestions`);
  if (documentId) {
    url.searchParams.append("document_id", documentId);
  }

  const headers = await getAuthHeaders();
  const response = await fetch(url.toString(), { headers });
  const data = await handleResponse<ChatbotSuggestionsResponse>(response);
  return data.suggestions ?? [];
}

export async function checkChatbotHealth(): Promise<ChatbotHealthResponse> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/v1/chatbot/health`, {
    headers,
  });
  return handleResponse<ChatbotHealthResponse>(response);
}

// ============================================================================
// CHAT HISTORY FUNCTIONS
// ============================================================================

export async function saveChatHistory(
  userId: string,
  documentId: string,
  messages: ChatHistoryItem[]
): Promise<{ status: string; count: number }> {
  const headers = await getAuthHeaders();
  headers["Content-Type"] = "application/json";

  const response = await fetch(`${API_BASE_URL}/api/v1/chat/history/save`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      user_id: userId,
      document_id: documentId,
      messages: messages,
    }),
  });

  return handleResponse<{ status: string; count: number }>(response);
}

export async function getChatHistory(
  userId: string,
  documentId: string
): Promise<ChatHistoryItem[]> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/api/v1/chat/history/${userId}/${documentId}`,
    { headers }
  );
  const data = await handleResponse<{ messages: any[] }>(response);
  return data.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

export async function deleteChatHistory(
  userId: string,
  documentId: string
): Promise<{ status: string }> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/api/v1/chat/history/${userId}/${documentId}`,
    { method: "DELETE", headers }
  );

  return handleResponse<{ status: string }>(response);
}

export async function deleteAccount(): Promise<{ status: string; message: string }> {
  const headers = await getAuthHeaders();
  const response = await fetch(
    `${API_BASE_URL}/api/v1/auth/delete-account`,
    {
      method: "DELETE",
      headers,
    }
  );

  return handleResponse<{ status: string; message: string }>(response);
}
