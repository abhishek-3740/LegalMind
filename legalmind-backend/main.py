from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List, Dict
import os
import shutil
import uuid
from datetime import datetime
from pathlib import Path
import json
from dotenv import load_dotenv
import tempfile
import jwt

from ml_pipeline.Document_loader import IngestionPipeline, PipelineConfig
from ml_pipeline.risk_detector import RiskDetectionPipeline
from ml_pipeline.LLM_advisory import AdvisoryPipeline, EnhancedRAGSystem
from ml_pipeline.chatbot import get_chatbot
from ml_pipeline.supabase_manager import get_supabase_manager

load_dotenv()

# Helper function to extract user ID from Authorization header
def get_user_id_from_token(authorization: Optional[str]) -> Optional[str]:
    """Extract user ID from JWT Bearer token"""
    if not authorization:
        return None
    
    try:
        # Extract token from "Bearer <token>"
        if not authorization.startswith("Bearer "):
            return None
        
        token = authorization.split(" ")[1]
        
        # Decode JWT (without verification for now, as we trust the token from frontend)
        # In production, you should verify the token signature
        decoded = jwt.decode(token, options={"verify_signature": False})
        return decoded.get("sub")  # Supabase uses 'sub' for user ID
    except Exception as e:
        print(f"Error decoding token: {e}")
        return None


print("\n" + "="*70)
print("[STARTUP] LEGALIND BACKEND INITIALIZATION")
print("="*70 + "\n")

# Test Supabase configuration
try:
    print("Testing Supabase configuration...")
    supabase_test = get_supabase_manager()
    print("[OK] Supabase connected successfully!\n")
except Exception as e:
    print(f"⚠️  Supabase connection failed: {e}")
    print("   Check your environment variables!\n")

# Create singleton instance to cache model
_risk_pipeline_cache = None

def get_risk_pipeline():
    """Get or create cached RiskDetectionPipeline instance"""
    global _risk_pipeline_cache
    if _risk_pipeline_cache is None:
        print("Initializing risk detection model...")
        _risk_pipeline_cache = RiskDetectionPipeline()
        print("[OK] Risk detection model ready!\n")
    return _risk_pipeline_cache

# Pre-load model on startup (comment out if you want lazy loading)
try:
    get_risk_pipeline()
except Exception as e:
    print(f"⚠️  Model pre-load failed: {e}")
    print("Model will be loaded on first upload instead.\n")

print("="*70)
print("[OK] SERVER READY")
print("="*70 + "\n")


class Config:
    UPLOAD_DIR = "uploads"
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    ALLOWED_EXTENSIONS = {".pdf"}
    
    # Supabase
    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Create directories
os.makedirs(Config.UPLOAD_DIR, exist_ok=True)


app = FastAPI(
    title="LegalMind API",
    description="AI-powered legal contract analysis",
    version="1.0.0"
)

# CORS - Allow React frontend (development: allow all localhost origins)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


jobs = {}  # {job_id: {status, progress, result}}

class JobStatus:
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


# ============================================================================
# HEALTH CHECK ENDPOINT (For HuggingFace Spaces)
# ============================================================================
@app.get("/health", tags=["Health"])
def health_check():
    """Health check endpoint for monitoring and orchestration"""
    return {
        "status": "healthy",
        "service": "LegalMind Backend",
        "version": "1.0.0"
    }


@app.get("/", tags=["Root"])
def root():
    """Root endpoint with API information"""
    return {
        "message": "LegalMind Backend API",
        "docs": "/docs",
        "version": "1.0.0"
    }


class UploadResponse(BaseModel):
    job_id: str
    status: str
    message: str

class JobStatusResponse(BaseModel):
    job_id: str
    status: str
    progress: int
    stage: str
    result: Optional[Dict] = None
    error: Optional[str] = None

class ChatRequest(BaseModel):
    document_id: str
    message: str
    chat_history: Optional[List[Dict]] = None

class ChatResponse(BaseModel):
    response: str
    timestamp: str

class ChatbotRequest(BaseModel):
    message: str
    chat_history: Optional[List[Dict]] = None
    document_id: Optional[str] = None

class ChatbotResponse(BaseModel):
    response: str
    timestamp: str
    suggestions: Optional[List[str]] = None


def process_document_pipeline(
    job_id: str, 
    file_path: str, 
    user_id: Optional[str] = None
):
    """
    Run 3-stage pipeline in background with Supabase integration:
    1. Document Loader (PDF → Chunks → Vector DB)
    2. Risk Detector (Classify chunks)
    3. LLM Advisory (Generate report + Enable chat)
    4. Save to Supabase (database + storage)
    5. Delete temporary files (memory optimization)
    """
    supabase_manager = None
    temp_dir = None
    
    try:
        # Initialize Supabase manager
        try:
            supabase_manager = get_supabase_manager()
        except Exception as e:
            print(f"⚠️  Supabase initialization failed: {e}")
            print(f"⚠️  Continuing without cloud storage. Check your environment variables!")
            supabase_manager = None
        
        # Create temporary directory for processing
        temp_dir = tempfile.mkdtemp()
        
        # Update status
        jobs[job_id]["status"] = JobStatus.PROCESSING
        jobs[job_id]["stage"] = "Extracting text from PDF"
        jobs[job_id]["progress"] = 10
        
        # If Supabase configured, update status in database
        if supabase_manager and user_id:
            try:
                supabase_manager.update_document_status(
                    job_id, 
                    "processing"
                )
            except Exception as e:
                print(f"⚠️  Could not update status in Supabase: {e}")
        
        # STAGE 1: Document Loading
        config = PipelineConfig(
            chunk_size=1000,
            chunk_overlap=200,
            embedding_model="sentence-transformers/all-MiniLM-L6-v2"
        )
        ingestion = IngestionPipeline(config)
        ingest_result = ingestion.ingest_document(file_path)
        
        jobs[job_id]["progress"] = 40
        jobs[job_id]["stage"] = "Detecting risks with AI model"
        
        # STAGE 2: Risk Detection
        risk_pipeline = get_risk_pipeline()
        risk_result = risk_pipeline.process_chunks(ingest_result['chunks_path'])
        
        jobs[job_id]["progress"] = 70
        jobs[job_id]["stage"] = "Generating legal advisory"
        
        # STAGE 3: Advisory Generation
        advisory = AdvisoryPipeline()
        report_path = advisory.process(
            risky_file=risk_result['risky_chunks_file'],
            safe_file=risk_result['safe_chunks_file'],
            vector_db_path=ingest_result['vector_db_path'],
            enable_chat=False
        )
        
        # Calculate risk score
        total = risk_result['total_chunks']
        risky = risk_result['risky_count']
        risk_score = int((risky / total) * 100) if total > 0 else 0
        
        # Read report content
        with open(report_path, 'r', encoding='utf-8') as f:
            report_content = f.read()
        
        # Load risky chunks for saving to Supabase
        risky_chunks_data = []
        if risky > 0:
            with open(risk_result['risky_chunks_file'], 'r', encoding='utf-8') as f:
                risky_chunks_data = json.load(f)
        
        # ================================================================
        # SAVE TO SUPABASE (if configured)
        # ================================================================
        jobs[job_id]["progress"] = 85
        jobs[job_id]["stage"] = "Saving results to cloud"
        
        if supabase_manager and user_id:
            try:
                # 1. Save document metadata
                supabase_manager.save_document_metadata(
                    user_id=user_id,
                    filename=Path(file_path).name,
                    document_id=job_id,
                    risk_score=risk_score,
                    risky_chunks_count=risky,
                    total_chunks=total,
                    status="completed"
                )
                
                # 2. Save risky chunks to database
                if risky_chunks_data:
                    supabase_manager.save_risky_chunks_batch(
                        document_id=job_id,
                        chunks=risky_chunks_data
                    )
                
                # 3. Upload vector store to storage
                supabase_manager.upload_vector_store(
                    document_id=job_id,
                    user_id=user_id,
                    vector_store_path=ingest_result['vector_db_path']
                )
                
                # 4. Upload report to storage
                supabase_manager.upload_report(
                    document_id=job_id,
                    user_id=user_id,
                    report_content=report_content
                )
                
                print(f"✓ Document {job_id} saved to Supabase")
                
            except Exception as e:
                print(f"⚠️  Error saving to Supabase: {e}")
                # Continue even if Supabase fails
        
        # ================================================================
        # PRESERVE NECESSARY DATA BEFORE CLEANUP
        # ================================================================
        jobs[job_id]["progress"] = 90
        jobs[job_id]["stage"] = "Saving analysis data"
        
        # Load risky and safe chunks into memory BEFORE deleting files
        risky_chunks_for_memory = []
        safe_chunks_for_memory = []
        
        try:
            if os.path.exists(risk_result.get('risky_chunks_file', '')):
                with open(risk_result['risky_chunks_file'], 'r', encoding='utf-8') as f:
                    risky_chunks_for_memory = json.load(f)
        except Exception as e:
            print(f"⚠️  Could not load risky chunks: {e}")
        
        try:
            if os.path.exists(risk_result.get('safe_chunks_file', '')):
                with open(risk_result['safe_chunks_file'], 'r', encoding='utf-8') as f:
                    safe_chunks_for_memory = json.load(f)
        except Exception as e:
            print(f"⚠️  Could not load safe chunks: {e}")
        
        # ================================================================
        # CLEANUP TEMPORARY FILES (Memory Optimization)
        # ================================================================
        jobs[job_id]["progress"] = 95
        jobs[job_id]["stage"] = "Cleaning up temporary files"
        
        # Delete temporary files (but NOT the vector DB path since we might need it for chat)
        cleanup_files = [
            file_path,  # Original PDF
            ingest_result.get('chunks_path'),  # Raw chunks
            risk_result.get('risky_chunks_file'),  # Risky chunks JSON
            risk_result.get('safe_chunks_file'),  # Safe chunks JSON
            report_path,  # Report text (already saved to Supabase)
        ]
        
        for file_to_delete in cleanup_files:
            if file_to_delete and os.path.exists(file_to_delete):
                try:
                    if os.path.isdir(file_to_delete):
                        shutil.rmtree(file_to_delete)
                    else:
                        os.remove(file_to_delete)
                    print(f"✓ Deleted: {file_to_delete}")
                except Exception as e:
                    print(f"⚠️  Could not delete {file_to_delete}: {e}")
        
        # Success!
        jobs[job_id]["status"] = JobStatus.COMPLETED
        jobs[job_id]["progress"] = 100
        jobs[job_id]["stage"] = "Analysis complete"
        jobs[job_id]["result"] = {
            "document_id": job_id,
            "user_id": user_id,
            "file_name": Path(file_path).name,
            "upload_date": datetime.now().isoformat(),
            "status": "completed",
            "risk_score": risk_score,
            "total_chunks": total,
            "risky_chunks": risky,
            "safe_chunks": risk_result['safe_count'],
            "report_content": report_content,
            "risky_chunks_data": risky_chunks_for_memory,
            "safe_chunks_data": safe_chunks_for_memory,
            "vector_db_path": ingest_result.get('vector_db_path'),
        }
        
        print(f"✓ Pipeline completed for {job_id}")
        
    except Exception as e:
        jobs[job_id]["status"] = JobStatus.FAILED
        jobs[job_id]["error"] = str(e)
        
        # Update Supabase with error status
        if supabase_manager:
            try:
                supabase_manager.update_document_status(
                    job_id,
                    "failed",
                    error_message=str(e)
                )
            except:
                pass
        
        print(f"❌ Error processing {job_id}: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Cleanup temporary directory
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
                print(f"✓ Cleaned temporary directory: {temp_dir}")
            except Exception as e:
                print(f"⚠️  Could not delete temp dir: {e}")



# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/")
def read_root():
    """Health check"""
    return {"status": "healthy", "service": "LegalMind API"}

@app.post("/api/v1/upload", response_model=UploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user_id: Optional[str] = Header(None)
):
    """
    Upload PDF for analysis
    Returns job_id for tracking progress
    
    Headers:
        user-id: Optional Supabase user ID for cloud storage
    """
    
    try:
        # Validate file exists
        if not file or not file.filename:
            raise HTTPException(400, "No file provided")
        
        # Validate file format
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(400, "Only PDF files allowed. File must end with .pdf")
        
        # Check file size
        file.file.seek(0, 2)  # Seek to end
        file_size = file.file.tell()
        file.file.seek(0)  # Reset
        
        if file_size == 0:
            raise HTTPException(400, "File is empty. Please upload a valid PDF")
        
        if file_size > Config.MAX_FILE_SIZE:
            max_mb = Config.MAX_FILE_SIZE // 1024 // 1024
            raise HTTPException(400, f"File too large. Max {max_mb}MB allowed")
        
        # Generate unique job ID
        job_id = str(uuid.uuid4())
        
        # Save uploaded file to temporary location
        file_path = os.path.join(Config.UPLOAD_DIR, f"{job_id}.pdf")
        try:
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        except Exception as e:
            raise HTTPException(400, f"Failed to save file: {str(e)}")
        
        # Create job
        jobs[job_id] = {
            "status": JobStatus.PENDING,
            "progress": 0,
            "stage": "Queued",
            "file_name": file.filename,
            "created_at": datetime.now().isoformat()
        }
        
        # Add to background tasks (pass user_id if provided)
        background_tasks.add_task(process_document_pipeline, job_id, file_path, user_id)
        
        print(f"✓ Upload request received: {file.filename} ({job_id})")
        
        return UploadResponse(
            job_id=job_id,
            status="pending",
            message="Document uploaded successfully. Processing started."
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Unexpected upload error: {e}")
        raise HTTPException(400, f"Upload failed: {str(e)}")

@app.get("/api/v1/job/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: str):
    """
    Get processing status of uploaded document
    Frontend polls this endpoint
    """
    if job_id not in jobs:
        raise HTTPException(404, "Job not found")
    
    job = jobs[job_id]
    
    return JobStatusResponse(
        job_id=job_id,
        status=job["status"],
        progress=job.get("progress", 0),
        stage=job.get("stage", "Unknown"),
        result=job.get("result"),
        error=job.get("error")
    )

@app.get("/api/v1/documents")
def list_documents(authorization: Optional[str] = Header(None, alias="Authorization")):
    """
    List all processed documents for current user from Supabase database
    FIXED: Queries persistent Supabase table instead of in-memory jobs dict
    """
    user_id = get_user_id_from_token(authorization)
    
    if not user_id:
        return {"documents": []}
    
    try:
        supabase_manager = get_supabase_manager()
        
        # ✅ Query Supabase documents table directly (not in-memory jobs dict)
        response = supabase_manager.client.table("documents") \
            .select("*") \
            .eq("user_id", user_id) \
            .eq("status", "completed") \
            .order("upload_date", desc=True) \
            .execute()
        
        documents = response.data if response.data else []
        
        # Format documents with all required fields for frontend
        formatted_documents = []
        for doc in documents:
            # Create document object with guaranteed fields
            # Map database column 'filename' to frontend field 'file_name'
            formatted_doc = {
                "document_id": doc.get("id") or doc.get("document_id"),
                "id": doc.get("id"),
                "file_name": doc.get("filename") or doc.get("file_name", "Untitled Document"),  # Map filename → file_name
                "risk_score": doc.get("risk_score", 0),
                "risky_chunks": doc.get("risky_chunks_count", 0),
                "total_chunks": doc.get("total_chunks", 0),
                "upload_date": doc.get("upload_date"),
                "status": doc.get("status", "completed"),
                "user_id": doc.get("user_id"),
                # Preserve any other fields from Supabase
                **{k: v for k, v in doc.items() 
                   if k not in ["id", "document_id", "filename", "file_name", "risk_score", 
                               "risky_chunks_count", "total_chunks", "upload_date", 
                               "status", "user_id"]}
            }
            formatted_documents.append(formatted_doc)
        
        print(f"✓ Returning {len(formatted_documents)} documents for user {user_id}")
        return {"documents": formatted_documents}
    
    except Exception as e:
        print(f"❌ Error listing documents from Supabase: {e}")
        import traceback
        traceback.print_exc()
        return {"documents": []}

@app.get("/api/v1/document-exists/{document_id}")
def check_document_exists(document_id: str, authorization: Optional[str] = Header(None, alias="Authorization")):
    """
    Verify if document exists and belongs to current user
    NEW ENDPOINT: Returns 404 if document deleted, doesn't exist, or belongs to another user
    """
    user_id = get_user_id_from_token(authorization)
    
    try:
        supabase_manager = get_supabase_manager()
        
        # Query Supabase to verify document exists
        response = supabase_manager.client.table("documents") \
            .select("id, user_id, status") \
            .eq("id", document_id) \
            .single() \
            .execute()
        
        if not response.data:
            print(f"⚠️  Document not found: {document_id}")
            return {"exists": False, "message": "Document not found"}
        
        doc = response.data
        
        # Verify user owns this document (security check)
        if user_id and doc.get("user_id") != user_id:
            print(f"⚠️  Unauthorized access to document: {document_id}")
            return {"exists": False, "message": "Unauthorized"}
        
        # Check if document was deleted or failed
        status = doc.get("status")
        if status in ["deleted", "failed"]:
            print(f"⚠️  Document unavailable (status={status}): {document_id}")
            return {"exists": False, "message": "Document unavailable"}
        
        return {
            "exists": True,
            "status": status,
            "message": "Document available"
        }
    
    except Exception as e:
        print(f"❌ Error checking document existence: {e}")
        return {"exists": False, "message": f"Error: {str(e)}"}

@app.get("/api/v1/document/{document_id}")
def get_document_details(document_id: str, authorization: Optional[str] = Header(None, alias="Authorization")):
    """
    Get detailed analysis of a document
    Loads from jobs dict (if in memory) OR Supabase (if persisted)
    """
    # Try jobs dict first (for documents still being processed)
    if document_id in jobs:
        job = jobs[document_id]
        if job["status"] != JobStatus.COMPLETED:
            raise HTTPException(400, "Document not fully processed yet")
        
        # Check user authorization
        user_id = get_user_id_from_token(authorization)
        job_user_id = job.get("result", {}).get("user_id")
        if user_id and job_user_id and job_user_id != user_id:
            raise HTTPException(403, "Unauthorized: Document belongs to another user")
        
        result = job["result"]
        risky_chunks = result.get("risky_chunks_data", [])
        
        # Format findings
        findings = []
        for chunk in risky_chunks[:10]:  # Top 10
            findings.append({
                "id": chunk.get("chunk_id", ""),
                "type": chunk.get("prediction", {}).get("label", "unknown"),
                "severity": "high" if chunk.get("prediction", {}).get("confidence", 0) > 0.85 else "medium",
                "clause": chunk.get("text", "")[:500],  # Truncate
                "confidence": chunk.get("prediction", {}).get("confidence", 0)
            })
        
        return {
            "document_id": result.get("document_id"),
            "file_name": result.get("file_name"),
            "upload_date": result.get("upload_date"),
            "status": result.get("status"),
            "risk_score": result.get("risk_score"),
            "total_chunks": result.get("total_chunks"),
            "risky_chunks": result.get("risky_chunks"),
            "safe_chunks": result.get("safe_chunks"),
            "findings": findings
        }
    
    # Fallback to Supabase for persisted documents
    try:
        user_id = get_user_id_from_token(authorization)
        supabase_manager = get_supabase_manager()
        
        # Query Supabase
        response = supabase_manager.client.table("documents") \
            .select("*") \
            .eq("id", document_id) \
            .single() \
            .execute()
        
        doc = response.data
        
        # Verify user owns document
        if user_id and doc.get("user_id") != user_id:
            raise HTTPException(403, "Unauthorized: Document belongs to another user")
        
        # Return document details from Supabase
        return {
            "document_id": doc.get("id"),
            "file_name": doc.get("filename") or doc.get("file_name", "Unknown"),
            "upload_date": doc.get("upload_date"),
            "status": doc.get("status"),
            "risk_score": doc.get("risk_score", 0),
            "total_chunks": doc.get("total_chunks", 0),
            "risky_chunks": doc.get("risky_chunks_count", 0),
            "safe_chunks": doc.get("total_chunks", 0) - doc.get("risky_chunks_count", 0),
            "findings": []  # Findings would need to be loaded from risky_chunks table
        }
    except Exception as e:
        print(f"❌ Error getting document from Supabase: {e}")
        raise HTTPException(404, "Document not found")

@app.post("/api/v1/chat", response_model=ChatResponse)
def chat_with_document(request: ChatRequest, authorization: Optional[str] = Header(None, alias="Authorization")):
    """
    Chat about a specific document using RAG
    Loads from jobs dict (if in memory) OR Supabase (if persisted)
    """
    # Try jobs dict first (for documents still being processed)
    if request.document_id in jobs:
        job = jobs[request.document_id]
        if job["status"] != JobStatus.COMPLETED:
            raise HTTPException(400, "Document not processed yet")
        
        # Check user authorization
        user_id = get_user_id_from_token(authorization)
        job_user_id = job.get("result", {}).get("user_id")
        if user_id and job_user_id and job_user_id != user_id:
            raise HTTPException(403, "Unauthorized: Document belongs to another user")
        
        result = job["result"]
        
        # Load advisories from stored memory data
        risky_chunks = result.get("risky_chunks_data", [])
        
        # Get vector_db_path
        vector_db_path = result.get("vector_db_path")
        if not vector_db_path or not os.path.exists(vector_db_path):
            raise HTTPException(400, "Vector database not available for this document")
        
        # Initialize RAG system (in production, cache this)
        rag = EnhancedRAGSystem(
            vector_db_path=vector_db_path,
            advisories=risky_chunks,
            doc_name=result.get("file_name", "document")
        )
        
        # Get response
        response_text = rag.chat(request.message, request.chat_history)
        
        return ChatResponse(
            response=response_text,
            timestamp=datetime.now().isoformat()
        )
    
    # Fallback to Supabase for persisted documents
    try:
        user_id = get_user_id_from_token(authorization)
        supabase_manager = get_supabase_manager()
        
        # First verify document exists in Supabase
        doc_response = supabase_manager.client.table("documents") \
            .select("*") \
            .eq("id", request.document_id) \
            .single() \
            .execute()
        
        doc = doc_response.data
        
        # Verify user owns document
        if user_id and doc.get("user_id") != user_id:
            raise HTTPException(403, "Unauthorized: Document belongs to another user")
        
        # Try to load vector store from Supabase storage
        # For now, return a helpful message
        raise HTTPException(400, "Document vector store not available. This document needs to be reprocessed.")
    
    except HTTPException:
        raise
    except:
        raise HTTPException(404, "Document not found")

@app.get("/api/v1/report/{document_id}")
def download_report(document_id: str, authorization: Optional[str] = Header(None, alias="Authorization")):
    """
    Download analysis report
    Loads from jobs dict (if in memory) OR Supabase storage (if persisted)
    """
    # Try jobs dict first (for documents still being processed)
    if document_id in jobs:
        job = jobs[document_id]
        if job["status"] != JobStatus.COMPLETED:
            raise HTTPException(400, "Document not processed yet")
        
        # Check user authorization
        user_id = get_user_id_from_token(authorization)
        job_user_id = job.get("result", {}).get("user_id")
        if user_id and job_user_id and job_user_id != user_id:
            raise HTTPException(403, "Unauthorized: Document belongs to another user")
        
        result = job["result"]
        report_content = result.get("report_content", "")
        
        if not report_content:
            raise HTTPException(400, "Report not available for this document")
        
        return {"report": report_content}
    
    # Fallback to Supabase storage for persisted documents
    try:
        user_id = get_user_id_from_token(authorization)
        supabase_manager = get_supabase_manager()
        
        # First verify document exists in Supabase
        doc_response = supabase_manager.client.table("documents") \
            .select("id, user_id") \
            .eq("id", document_id) \
            .single() \
            .execute()
        
        doc = doc_response.data
        
        # Verify user owns document
        if user_id and doc.get("user_id") != user_id:
            raise HTTPException(403, "Unauthorized: Document belongs to another user")
        
        # Download report from Supabase storage
        report_content = supabase_manager.get_report(document_id, doc.get("user_id"))
        
        if not report_content:
            raise HTTPException(400, "Report not available for this document")
        
        return {"report": report_content}
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error getting report from Supabase: {e}")
        raise HTTPException(404, "Report not found")

# ============================================================================
# CHATBOT ENDPOINTS
# ============================================================================

@app.post("/api/v1/chatbot", response_model=ChatbotResponse)
def chat_with_assistant(request: ChatbotRequest):
    """
    Chat with LegalMind AI Assistant
    Can be used with or without a specific document context
    """
    try:
        chatbot = get_chatbot()
        
        # Get document context if document_id is provided
        document_context = None
        document_name = None
        
        if request.document_id and request.document_id in jobs:
            job = jobs[request.document_id]
            if job["status"] == JobStatus.COMPLETED:
                result = job["result"]
                document_name = result.get("file_name")
                # Load risky chunks for context
                try:
                    with open(result["risky_file"], 'r', encoding='utf-8') as f:
                        risky_chunks = json.load(f)
                        # Create brief context
                        risk_summary = f"Document: {document_name}\n"
                        risk_summary += f"Risk Score: {result.get('risk_score')}%\n"
                        risk_summary += f"Risky Clauses: {result.get('risky_chunks')} / {result.get('total_chunks')}\n"
                        if risky_chunks:
                            risk_summary += f"Key Risks: {', '.join([c.get('prediction', {}).get('label', 'Unknown') for c in risky_chunks[:3]])}"
                        document_context = risk_summary
                except:
                    pass
        
        # Get response from chatbot
        response_text = chatbot.chat(
            user_message=request.message,
            chat_history=request.chat_history,
            document_context=document_context,
            document_name=document_name
        )
        
        # Get suggestions if no document context
        suggestions = None
        if not request.document_id:
            suggestions = chatbot.suggest_questions(document_name or "your contract")
        
        return ChatbotResponse(
            response=response_text,
            timestamp=datetime.now().isoformat(),
            suggestions=suggestions
        )
    
    except Exception as e:
        print(f"Chatbot error: {e}")
        raise HTTPException(500, f"Chatbot error: {str(e)}")

@app.get("/api/v1/chatbot/suggestions")
def get_chatbot_suggestions(document_id: Optional[str] = None):
    """
    Get suggested questions for the chatbot
    """
    try:
        chatbot = get_chatbot()
        
        doc_name = "your contract"
        if document_id and document_id in jobs:
            job = jobs[document_id]
            if job["status"] == JobStatus.COMPLETED:
                doc_name = job["result"].get("file_name", "your contract")
        
        suggestions = chatbot.suggest_questions(doc_name)
        return {"suggestions": suggestions}
    
    except Exception as e:
        print(f"Error getting suggestions: {e}")
        raise HTTPException(500, f"Error: {str(e)}")

@app.get("/api/v1/chatbot/health")
def chatbot_health():
    """
    Check if chatbot is initialized and ready
    """
    try:
        chatbot = get_chatbot()
        return {
            "status": "healthy",
            "model": chatbot.model,
            "ready": True
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "ready": False
        }


# ============================================================================
# CHAT HISTORY ENDPOINTS
# ============================================================================

class SaveChatRequest(BaseModel):
    user_id: str
    document_id: str
    messages: List[Dict]  # List of {role, content}

class ChatHistoryResponse(BaseModel):
    messages: List[Dict]
    total: int

@app.post("/api/v1/chat/history/save")
async def save_chat_history(request: SaveChatRequest, authorization: Optional[str] = Header(None, alias="Authorization")):
    """Save chat conversation to Supabase"""
    try:
        # Verify user can only save chat history for their own documents
        user_id = get_user_id_from_token(authorization)
        if user_id and request.user_id != user_id:
            raise HTTPException(403, "Unauthorized: Can only save chat history for own documents")
        
        supabase_manager = get_supabase_manager()
        count = supabase_manager.save_chat_messages_batch(
            user_id=request.user_id,
            document_id=request.document_id,
            messages=request.messages
        )
        return {
            "status": "success",
            "message": f"Saved {count} messages",
            "count": count
        }
    except Exception as e:
        print(f"❌ Error saving chat history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/chat/history/{user_id}/{document_id}")
async def get_chat_history(user_id: str, document_id: str, authorization: Optional[str] = Header(None, alias="Authorization")):
    """Retrieve chat conversation from Supabase"""
    try:
        # Verify user can only retrieve their own chat history
        token_user_id = get_user_id_from_token(authorization)
        if token_user_id and user_id != token_user_id:
            raise HTTPException(403, "Unauthorized: Can only retrieve own chat history")
        
        supabase_manager = get_supabase_manager()
        messages = supabase_manager.get_chat_history(user_id, document_id)
        return {
            "status": "success",
            "messages": messages,
            "total": len(messages)
        }
    except Exception as e:
        print(f"❌ Error retrieving chat history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/v1/chat/history/{user_id}/{document_id}")
async def delete_chat_history(user_id: str, document_id: str, authorization: Optional[str] = Header(None, alias="Authorization")):
    """Delete chat conversation from Supabase"""
    try:
        # Verify user can only delete their own chat history
        token_user_id = get_user_id_from_token(authorization)
        if token_user_id and user_id != token_user_id:
            raise HTTPException(403, "Unauthorized: Can only delete own chat history")
        
        supabase_manager = get_supabase_manager()
        success = supabase_manager.delete_chat_history(user_id, document_id)
        return {
            "status": "success" if success else "failed",
            "message": "Chat history deleted" if success else "Failed to delete"
        }
    except Exception as e:
        print(f"❌ Error deleting chat history: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/v1/auth/delete-account")
async def delete_account(authorization: Optional[str] = Header(None, alias="Authorization")):
    """Delete user account and all associated data"""
    try:
        # Extract user ID from token
        user_id = get_user_id_from_token(authorization)
        if not user_id:
            print(f"❌ Delete account: No valid token. Authorization header: {authorization}")
            raise HTTPException(status_code=401, detail="Unauthorized: No valid token provided")
        
        # Delete all documents belonging to this user from memory
        documents_to_delete = []
        for job_id, job in jobs.items():
            if job.get("result", {}).get("user_id") == user_id:
                documents_to_delete.append(job_id)
        
        for job_id in documents_to_delete:
            del jobs[job_id]
        
        # Call Supabase Manager to handle full deletion (DB + Storage + Auth)
        try:
            supabase_manager = get_supabase_manager()
            success = supabase_manager.delete_user_data(user_id)
            
            if not success:
                print(f"⚠️  Warning: Full deletion reported failure for {user_id}")
            
        except Exception as e:
            print(f"⚠️  Warning: Could not fully delete from Supabase: {e}")
        
        return {
            "status": "success",
            "message": "Account deleted successfully",
            "documents_deleted": len(documents_to_delete)
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error deleting account: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete account")
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )

