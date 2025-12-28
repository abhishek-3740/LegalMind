import { supabase } from "@/integrations/supabase/client";

export interface Document {
  id: string;
  title: string;
  file_path: string;
  file_name: string;
  file_size: number;
  file_type: string;
  status: "analyzing" | "safe" | "high-risk";
  risk_score: number | null;
  uploaded_at: string;
  updated_at: string;
  user_id: string;
}

export interface DocumentAnalysis {
  id: string;
  document_id: string;
  findings: Array<{
    id: string;
    severity: "high" | "medium" | "low";
    title: string;
    description: string;
    section: string;
  }>;
  recommendations: string[];
  risk_score: number;
  analyzed_at: string;
}

/**
 * Get all documents for the current user
 */
export async function getDocuments(): Promise<Document[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Error fetching documents:", error);
    throw error;
  }

  return data || [];
}

/**
 * Get a single document by ID
 */
export async function getDocument(id: string): Promise<Document | null> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching document:", error);
    throw error;
  }

  return data;
}

/**
 * Get document analysis by document ID
 */
export async function getDocumentAnalysis(documentId: string): Promise<DocumentAnalysis | null> {
  const { data, error } = await supabase
    .from("document_analyses")
    .select("*")
    .eq("document_id", documentId)
    .single();

  if (error) {
    console.error("Error fetching document analysis:", error);
    throw error;
  }

  return data;
}

/**
 * Create a new document record in the database
 */
export async function createDocumentRecord(
  filePath: string,
  fileName: string,
  fileSize: number,
  fileType: string
): Promise<Document> {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("User not authenticated");
  }

  const { data, error } = await supabase
    .from("documents")
    .insert({
      title: fileName,
      file_path: filePath,
      file_name: fileName,
      file_size: fileSize,
      file_type: fileType,
      status: "analyzing",
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating document record:", error);
    throw error;
  }

  return data;
}

/**
 * Update document status and risk score
 */
export async function updateDocumentStatus(
  documentId: string,
  status: Document["status"],
  riskScore?: number
): Promise<void> {
  const { error } = await supabase
    .from("documents")
    .update({
      status,
      risk_score: riskScore ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", documentId);

  if (error) {
    console.error("Error updating document status:", error);
    throw error;
  }
}

/**
 * Save document analysis results
 */
export async function saveDocumentAnalysis(
  documentId: string,
  analysis: Omit<DocumentAnalysis, "id" | "document_id" | "analyzed_at">
): Promise<DocumentAnalysis> {
  const { data, error } = await supabase
    .from("document_analyses")
    .insert({
      document_id: documentId,
      ...analysis,
      analyzed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error("Error saving document analysis:", error);
    throw error;
  }

  return data;
}

/**
 * Delete a document
 */
export async function deleteDocument(documentId: string): Promise<void> {
  // First delete the file from storage
  const { data: document } = await supabase
    .from("documents")
    .select("file_path")
    .eq("id", documentId)
    .single();

  if (document?.file_path) {
    const { error: storageError } = await supabase.storage
      .from("documents")
      .remove([document.file_path]);

    if (storageError) {
      console.error("Error deleting file from storage:", storageError);
    }
  }

  // Then delete the record
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);

  if (error) {
    console.error("Error deleting document:", error);
    throw error;
  }
}

