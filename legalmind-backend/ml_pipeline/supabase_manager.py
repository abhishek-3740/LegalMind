"""
supabase_manager.py
===================
Handles all Supabase database and storage operations
Optimized for memory efficiency with streaming and cleanup
"""

import json
import os
import io
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from pathlib import Path
from dotenv import load_dotenv

try:
    from supabase import create_client, Client
except ImportError:
    print("⚠️  Supabase client not installed. Install with: pip install supabase")

load_dotenv()


class SupabaseManager:
    """Manage all Supabase operations"""
    
    def __init__(self):
        self.supabase_url = os.getenv("VITE_SUPABASE_URL") or os.getenv("SUPABASE_URL")
        self.supabase_key = os.getenv("VITE_SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY")
        self.service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        
        if not self.supabase_url:
            raise ValueError("VITE_SUPABASE_URL or SUPABASE_URL not set in environment")
        if not self.supabase_key:
            raise ValueError("VITE_SUPABASE_ANON_KEY or SUPABASE_KEY not set in environment")
        
        # Create client with service role key for better permissions on storage
        client_key = self.service_role_key if self.service_role_key else self.supabase_key
        self.client: Client = create_client(self.supabase_url, client_key)
        
        # Also keep anon client for auth operations
        if self.supabase_key != client_key:
            self.anon_client: Client = create_client(self.supabase_url, self.supabase_key)
        else:
            self.anon_client = None
        
        # For admin operations (if available)
        if self.service_role_key:
            self.admin_client: Client = create_client(
                self.supabase_url, 
                self.service_role_key
            )
        else:
            self.admin_client = None
        
        print("✓ Supabase Manager initialized")
        print(f"  - URL: {self.supabase_url}")
        print(f"  - Using {'Service Role' if self.service_role_key else 'Anon'} key")
    
    # ========================================================================
    # DOCUMENT OPERATIONS
    # ========================================================================
    
    def save_document_metadata(
        self,
        user_id: str,
        filename: str,
        document_id: str,
        risk_score: float,
        risky_chunks_count: int,
        total_chunks: int,
        status: str = "processing"
    ) -> Dict:
        """Save document metadata to Supabase"""
        try:
            data = {
                "id": document_id,
                "user_id": user_id,
                "filename": filename,  # ✅ Correct: This is the actual database column
                "risk_score": risk_score,
                "risky_chunks_count": risky_chunks_count,
                "total_chunks": total_chunks,
                "status": status,
                "upload_date": datetime.now().isoformat(),
            }
            
            response = self.client.table("documents").insert(data).execute()
            print(f"✓ Document metadata saved: {document_id}")
            return response.data[0] if response.data else data
            
        except Exception as e:
            print(f"❌ Error saving document metadata: {e}")
            raise
    
    def update_document_status(
        self,
        document_id: str,
        status: str,
        error_message: Optional[str] = None
    ) -> Dict:
        """Update document processing status"""
        try:
            update_data = {"status": status}
            if error_message:
                update_data["error_message"] = error_message
            
            response = self.client.table("documents") \
                .update(update_data) \
                .eq("id", document_id) \
                .execute()
            
            print(f"✓ Document status updated: {document_id} → {status}")
            return response.data[0] if response.data else {}
            
        except Exception as e:
            print(f"❌ Error updating document status: {e}")
            raise
    
    def get_document(self, document_id: str) -> Optional[Dict]:
        """Retrieve document metadata"""
        try:
            response = self.client.table("documents") \
                .select("*") \
                .eq("id", document_id) \
                .single() \
                .execute()
            
            return response.data
            
        except Exception as e:
            print(f"❌ Error retrieving document: {e}")
            return None
    
    # ========================================================================
    # RISKY CHUNKS OPERATIONS
    # ========================================================================
    
    def save_risky_chunk(
        self,
        document_id: str,
        chunk_id: str,
        chunk_text: str,
        risk_label: str,
        confidence_score: float,
        severity: str,
        llm_analysis: Optional[str] = None
    ) -> Dict:
        """Save individual risky chunk to database"""
        try:
            data = {
                "document_id": document_id,
                "chunk_id": chunk_id,
                "chunk_text": chunk_text,
                "risk_label": risk_label,
                "confidence_score": confidence_score,
                "severity": severity,
                "llm_analysis": llm_analysis,
            }
            
            response = self.client.table("risky_chunks").insert(data).execute()
            return response.data[0] if response.data else data
            
        except Exception as e:
            print(f"❌ Error saving risky chunk: {e}")
            raise
    
    def save_risky_chunks_batch(
        self,
        document_id: str,
        chunks: List[Dict]
    ) -> int:
        """Save multiple risky chunks efficiently"""
        try:
            if not chunks:
                return 0
            
            # Format chunks for database
            formatted_chunks = []
            for chunk in chunks:
                # Determine severity based on confidence
                confidence = chunk.get('prediction', {}).get('confidence', 0.5)
                severity = 'high' if confidence > 0.8 else 'medium' if confidence > 0.6 else 'low'
                
                formatted_chunks.append({
                    "document_id": document_id,
                    "chunk_id": chunk.get('chunk_id', ''),
                    "chunk_text": chunk.get('text', ''),
                    "risk_label": chunk.get('prediction', {}).get('label', 'Unknown'),
                    "confidence_score": confidence,
                    "severity": severity,
                    "llm_analysis": None,  # Will be updated later if available
                })
            
            # Batch insert
            response = self.client.table("risky_chunks").insert(formatted_chunks).execute()
            print(f"✓ Saved {len(response.data)} risky chunks for {document_id}")
            return len(response.data)
            
        except Exception as e:
            print(f"❌ Error saving risky chunks batch: {e}")
            raise
    
    def get_risky_chunks(self, document_id: str) -> List[Dict]:
        """Retrieve all risky chunks for a document"""
        try:
            response = self.client.table("risky_chunks") \
                .select("*") \
                .eq("document_id", document_id) \
                .execute()
            
            return response.data or []
        
        except Exception as e:
            print(f"❌ Error retrieving risky chunks: {e}")
            return []
    
    # ========================================================================
    # CHAT HISTORY OPERATIONS
    # ========================================================================
    
    def save_chat_message(
        self,
        user_id: str,
        document_id: str,
        role: str,
        content: str,
        message_index: int
    ) -> Dict:
        """Save a single chat message to Supabase"""
        try:
            data = {
                "user_id": user_id,
                "document_id": document_id,
                "role": role,
                "content": content,
                "message_index": message_index,
            }
            
            response = self.client.table("chat_history").insert(data).execute()
            print(f"✓ Chat message saved for {document_id}")
            return response.data[0] if response.data else data
            
        except Exception as e:
            print(f"❌ Error saving chat message: {e}")
            raise
    
    def save_chat_messages_batch(
        self,
        user_id: str,
        document_id: str,
        messages: List[Dict]
    ) -> int:
        """Save multiple chat messages efficiently - replaces old messages"""
        try:
            if not messages:
                return 0
            
            # Delete existing chat history for this document (to prevent duplicates)
            # Only delete if we're saving new messages
            try:
                self.client.table("chat_history") \
                    .delete() \
                    .eq("user_id", user_id) \
                    .eq("document_id", document_id) \
                    .execute()
                print(f"✓ Cleared old chat history for {document_id}")
            except Exception as e:
                print(f"⚠️  Could not clear old chat history: {e}")
            
            # Now insert the fresh messages
            formatted_messages = []
            for idx, msg in enumerate(messages):
                formatted_messages.append({
                    "user_id": user_id,
                    "document_id": document_id,
                    "role": msg.get("role", "user"),
                    "content": msg.get("content", ""),
                    "message_index": idx,
                })
            
            response = self.client.table("chat_history").insert(formatted_messages).execute()
            print(f"✓ Saved {len(response.data)} chat messages for {document_id}")
            return len(response.data)
            
        except Exception as e:
            print(f"❌ Error saving chat messages batch: {e}")
            raise
    
    def get_chat_history(
        self,
        user_id: str,
        document_id: str
    ) -> List[Dict]:
        """Retrieve all chat messages for a document"""
        try:
            response = self.client.table("chat_history") \
                .select("*") \
                .eq("user_id", user_id) \
                .eq("document_id", document_id) \
                .order("message_index", desc=False) \
                .execute()
            
            return response.data or []
            
        except Exception as e:
            print(f"❌ Error retrieving chat history: {e}")
            return []
    
    def delete_chat_history(
        self,
        user_id: str,
        document_id: str
    ) -> bool:
        """Delete all chat messages for a document"""
        try:
            self.client.table("chat_history") \
                .delete() \
                .eq("user_id", user_id) \
                .eq("document_id", document_id) \
                .execute()
            
            print(f"✓ Chat history deleted for {document_id}")
            return True
            
        except Exception as e:
            print(f"❌ Error deleting chat history: {e}")
            return False
    
    # ========================================================================
    # STORAGE OPERATIONS
    # ========================================================================
    
    def upload_vector_store(
        self,
        document_id: str,
        user_id: str,
        vector_store_path: str
    ) -> str:
        """Upload FAISS vector store to Supabase storage"""
        try:
            import zipfile
            from io import BytesIO
            
            # Check if path is a directory (FAISS index directory)
            if os.path.isdir(vector_store_path):
                # Zip the entire directory
                zip_buffer = BytesIO()
                with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                    for root, dirs, files in os.walk(vector_store_path):
                        for file in files:
                            file_path = os.path.join(root, file)
                            arcname = os.path.relpath(file_path, vector_store_path)
                            zip_file.write(file_path, arcname)
                
                file_data = zip_buffer.getvalue()
                remote_path = f"documents/{user_id}/{document_id}/vector_store.zip"
            else:
                # Single file
                with open(vector_store_path, 'rb') as f:
                    file_data = f.read()
                remote_path = f"documents/{user_id}/{document_id}/vector_store.faiss"
            
            # Upload
            response = self.client.storage.from_("vector-stores").upload(
                remote_path,
                file_data,
                {"cacheControl": "3600"}
            )
            
            print(f"✓ Vector store uploaded: {remote_path}")
            return remote_path
            
        except Exception as e:
            print(f"❌ Error uploading vector store: {e}")
            raise
    
    def download_vector_store(
        self,
        document_id: str,
        user_id: str,
        local_path: str
    ) -> bool:
        """Download FAISS vector store from Supabase storage"""
        try:
            import zipfile
            from io import BytesIO
            
            # Try to download zipped version first
            remote_path = f"documents/{user_id}/{document_id}/vector_store.zip"
            
            try:
                response = self.client.storage.from_("vector-stores").download(remote_path)
                
                # Unzip to local path
                os.makedirs(local_path, exist_ok=True)
                zip_buffer = BytesIO(response)
                with zipfile.ZipFile(zip_buffer, 'r') as zip_file:
                    zip_file.extractall(local_path)
                
                print(f"✓ Vector store downloaded (zipped): {remote_path}")
                return True
            except:
                # Fallback to single file
                remote_path = f"documents/{user_id}/{document_id}/vector_store.faiss"
                response = self.client.storage.from_("vector-stores").download(remote_path)
                
                # Save locally
                with open(local_path, 'wb') as f:
                    f.write(response)
                
                print(f"✓ Vector store downloaded (single file): {remote_path}")
                return True
            
        except Exception as e:
            print(f"❌ Error downloading vector store: {e}")
            return False
    
    def upload_report(
        self,
        document_id: str,
        user_id: str,
        report_content: str
    ) -> str:
        """Upload report text to Supabase storage"""
        try:
            # Convert text to bytes
            file_data = report_content.encode('utf-8')
            
            # Upload path
            remote_path = f"documents/{user_id}/{document_id}/report.txt"
            
            # Upload
            response = self.client.storage.from_("reports").upload(
                remote_path,
                file_data,
                {"cacheControl": "3600"}
            )
            
            print(f"✓ Report uploaded: {remote_path}")
            return remote_path
            
        except Exception as e:
            print(f"❌ Error uploading report: {e}")
            raise
    
    def get_report(
        self,
        document_id: str,
        user_id: str
    ) -> Optional[str]:
        """Retrieve report from Supabase storage"""
        try:
            remote_path = f"documents/{user_id}/{document_id}/report.txt"
            
            # Download
            response = self.client.storage.from_("reports").download(remote_path)
            
            # Decode to string
            report_text = response.decode('utf-8')
            return report_text
            
        except Exception as e:
            print(f"❌ Error retrieving report: {e}")
            return None
    
    # ========================================================================
    # CLEANUP OPERATIONS
    # ========================================================================
    
    def cleanup_document_storage(
        self,
        document_id: str,
        user_id: str
    ) -> bool:
        """Delete document files from Supabase storage"""
        try:
            # Delete vector store
            try:
                self.client.storage.from_("vector-stores").remove(
                    [f"documents/{user_id}/{document_id}/vector_store.faiss"]
                )
            except:
                pass
            
            # Delete report
            try:
                self.client.storage.from_("reports").remove(
                    [f"documents/{user_id}/{document_id}/report.txt"]
                )
            except:
                pass
            
            print(f"✓ Cleaned up storage for document: {document_id}")
            return True
            
        except Exception as e:
            print(f"❌ Error cleaning up storage: {e}")
            return False
            
    def delete_user_data(self, user_id: str) -> bool:
        """
        Delete ALL user data from Supabase:
        1. Database records (documents, chat_history, risky_chunks)
        2. Storage files (reports, vector stores)
        3. Auth user account (requires admin client)
        """
        try:
            print(f"-------- DELETING DATA FOR USER: {user_id} --------")
            
            # 1. Get list of documents to clean up storage
            try:
                response = self.client.table("documents").select("id").eq("user_id", user_id).execute()
                documents = response.data or []
                
                for doc in documents:
                    self.cleanup_document_storage(doc["id"], user_id)
            except Exception as e:
                print(f"⚠️  Error cleaning up user storage: {e}")
            
            # 2. Delete database records
            # Note: Cascade delete might handle some of this, but we'll be explicit
            
            # Delete chat history
            try:
                self.client.table("chat_history").delete().eq("user_id", user_id).execute()
                print("✓ Deleted chat history")
            except Exception as e:
                print(f"⚠️  Error deleting chat history: {e}")
                
            # Delete risky chunks (usually associated via document_id, but safer to check)
            # This might fail if no direct user_id link, but documents deletion cascades usually
            
            # Delete documents (should cascade to risky_chunks)
            try:
                self.client.table("documents").delete().eq("user_id", user_id).execute()
                print("✓ Deleted documents record")
            except Exception as e:
                print(f"⚠️  Error deleting documents: {e}")
            
            # 3. Delete User from Auth (Requires Service Role)
            if self.admin_client:
                try:
                    self.admin_client.auth.admin.delete_user(user_id)
                    print(f"✓ Deleted user {user_id} from Auth")
                except Exception as e:
                    print(f"❌ Error deleting user from Auth: {e}")
                    # This is critical, but we did our best with data
            else:
                print("⚠️  Cannot delete Auth user: No service role key available")
                
            print(f"✓ Account deletion process completed for {user_id}")
            return True
            
        except Exception as e:
            print(f"❌ Critical error in delete_user_data: {e}")
            return False


# ============================================================================
# SINGLETON INSTANCE
# ============================================================================

_supabase_manager: Optional[SupabaseManager] = None


def get_supabase_manager() -> SupabaseManager:
    """Get or create Supabase manager instance"""
    global _supabase_manager
    if _supabase_manager is None:
        _supabase_manager = SupabaseManager()
    return _supabase_manager
