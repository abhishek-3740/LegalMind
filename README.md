# ⚖️ LegalMind: AI Contract Risk Analyzer
[![Live Demo](https://img.shields.io/badge/demo-Live%20App-blueviolet?style=for-the-badge&logo=vercel)](https://legalmind-frontend-eight.vercel.app)
![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-High_Performance-green.svg)
![Architecture](https://img.shields.io/badge/architecture-Event_Driven-orange.svg)
![AI](https://img.shields.io/badge/AI-LangChain_RAG-purple.svg)

**LegalMind** is a high-performance backend system designed for automated contract analysis. It orchestrates a complex **3-stage AI pipeline** involving OCR, Vector Search (RAG), and Ensemble Classification to detect legal risks, powered by a **Legal-BERT + DeBERTa-v3** ensemble (**97.74% accuracy**) fine-tuned by my teammate Nikhil.

While it includes a minimal React frontend for demonstration, the core value lies in its **robust API architecture, asynchronous task management, and custom ML pipelines**.

> **🚀 [Try the Live App on Vercel](https://legalmind-frontend-eight.vercel.app/)**

---

## 🙏 Team & Model Attribution

This is a two-person project. The risk-classification ensemble was **trained and evaluated by my teammate Nikhil** — a fine-tuned Legal-BERT + DeBERTa-v3 ensemble (97.74% accuracy). Credit for model training belongs to him.

My contribution is everything around the model — OCR ingestion, chunking, embeddings, FAISS retrieval, the FastAPI service layer, async job management, Supabase persistence with row-level security, and the frontend.

---

## 🚀 Backend Architecture & Features

### **1. Advanced AI Pipeline**
The system implements a custom ingestion pipeline using **LangChain** and **PyMuPDF**:
* **Hybrid OCR Engine:** Intelligently switches between text extraction and OCR (Tesseract) based on document density.
* **Ensemble Risk Detection:** A **Legal-BERT + DeBERTa-v3 ensemble** (97.74% accuracy, fine-tuned by my teammate Nikhil) flags specific clauses (e.g., *Unlimited Liability*, *Unfair Termination*).
* **Local RAG System:** Uses `sentence-transformers/all-MiniLM-L6-v2` (running on CPU) and **FAISS** for low-latency, private vector search.

### **2. Asynchronous Job Processing**
* Built on **FastAPI BackgroundTasks** to handle long-running ML inference without blocking API response times.
* Implements a polling pattern (`/job/{id}`) for client-side status updates.

### **3. Scalable Data Infrastructure**
* **Vector persistence:** FAISS indices are serialized and backed up to cloud storage.
* **Supabase Integration:** Acts as a managed PostgreSQL + Storage layer to persist transaction logs, chat history, and document metadata — with **row-level security** enforcing per-user document isolation.

---

## 🛠️ Technical Stack

### **Core Backend (`/legalmind-backend`)**
* **API Framework:** FastAPI (Pydantic models, Dependency Injection)
* **ML Orchestration:** LangChain, Hugging Face `transformers`
* **Risk Classifier:** Legal-BERT + DeBERTa-v3 ensemble by my teammate Nikhil (loaded via `snapshot_download`)
* **Vector Database:** FAISS (Local in-memory speed)
* **Embeddings:** `all-MiniLM-L6-v2` (Optimized for CPU inference)
* **Storage & DB:** Supabase (PostgreSQL + Object Storage).

### **Frontend Utility (`/legalmind-frontend`)**
* *Minimal UI built with React & Vite to visualize the API outputs.*
* **Framework:** React + Vite.
* **Deployment:** Vercel (Production URL: `legalmind-frontend-eight.vercel.app`).
---

## ⚡ API Architecture

The system exposes a RESTful API designed for scalability. Key endpoints include:

### **Pipeline Control**
* `POST /api/v1/upload` - Initiates the asynchronous ingestion pipeline.
    * *Payload:* PDF Binary
    * *Process:* OCR -> Chunking -> Embedding -> Risk Classification -> Storage
* `GET /api/v1/job/{job_id}` - Polling endpoint for pipeline status.

### **RAG & Inference**
* `POST /api/v1/chat` - Context-aware QA using retrieved vector chunks.
* `GET /api/v1/document/{id}` - Returns structured risk analysis and model confidence scores.

---

## 🏗️ System Design

The architecture follows a modular, three-stage pipeline to handle secure document ingestion, high-accuracy risk classification, and generative reporting.

```mermaid
graph TD
    User((User)) -->|Upload PDF| FastAPI

    subgraph "Stage 1: Ingestion (Privacy)"
        FastAPI[FastAPI Gateway] --> Hybrid["Hybrid Extraction<br/>(PyMuPDF + Tesseract OCR)"]
        Hybrid -->|Chunking & Vectorization| FAISS[(FAISS)]
    end

    FAISS --> Ensemble

    subgraph "Stage 2: The Risk Filter"
        Ensemble["Ensemble Classifier<br/>(by teammate Nikhil, 97.74% acc)"] -->|Safe Content| Safe["Ignore / Archive"]
        Ensemble -->|🚨 HIGH RISK >70%| Risky["Risky Clauses Only"]
    end

    Risky -->|Inject Context| LLM

    subgraph "Stage 3: Generative"
        LLM["LLM Consultant"] -->|Generate| Report["Generate Detailed Report<br/>on Risky Clauses"]
    end

    Report -->|Save Results| DB[(Supabase Cloud)]
    DB -->|Deliver| UI["Interactive Report & Chat"]
 ```

## 📦 Local Setup

### **1. Backend Environment (Primary)**
```bash
cd legalmind-backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install ML & API dependencies
pip install -r requirements.txt

# Configure Environment
# Create .env with Supabase credentials
```

### **2. Run the Engine**
```bash
python main.py

# The high-performance API starts on http://localhost:8000
# API Documentation available at http://localhost:8000/docs
```


### **3. Frontend **
```bash
cd legalmind-frontend

# Install Node dependencies
npm install

# Start development server
npm run dev

# UI runs on http://localhost:8080 (or 5173)
```
