"""
LLM_advisory.py - Stage 3 (FIXED RISK RETRIEVAL)
=================================================
Now properly retrieves and displays detected risks first
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict
from dotenv import load_dotenv

from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEndpointEmbeddings
from langchain_core.documents import Document

load_dotenv()


# ============================================================================
# CONFIGURATION
# ============================================================================

class Config:
    """Configuration"""
    
    # Paths
    RISKY_CHUNKS_DIR = "risk_analysis_results/risky_chunks"
    SAFE_CHUNKS_DIR = "risk_analysis_results/safe_chunks"
    REPORTS_DIR = "risk_analysis_results/reports"
    VECTOR_DB_DIR = "vector_db"
    
    # LLM (from .env)
    OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
    OPENAI_API_BASE = os.getenv("OPENAI_API_BASE", "https://openrouter.ai/api/v1")
    LLM_MODEL = os.getenv("LLM_MODEL", "kwaipilot/kat-coder-pro:free")
    
    # Embeddings
    EMBEDDING_MODEL = "google/embeddinggemma-300m"
    HF_TOKEN = os.getenv("HF_TOKEN")
    
    @classmethod
    def setup_directories(cls):
        os.makedirs(cls.REPORTS_DIR, exist_ok=True)


# ============================================================================
# ADVISORY GENERATOR
# ============================================================================

class AdvisoryGenerator:
    """Generate LLM advisory for risky clauses"""
    
    def __init__(self):
        self.llm = ChatOpenAI(
            model=Config.LLM_MODEL,
            openai_api_key=Config.OPENAI_API_KEY,
            openai_api_base=Config.OPENAI_API_BASE,
            temperature=0.7,
            max_tokens=800
        )
    
    def analyze_risk(self, chunk: Dict) -> Dict:
        """Analyze risky clause"""
        risk_type = chunk['prediction']['label']
        confidence = chunk['prediction']['confidence']
        clause_text = chunk['text']
        
        # Truncate long clauses
        if len(clause_text) > 1000:
            clause_text = clause_text[:1000] + "..."
        
        prompt = f"""You are an expert legal advisor. Analyze this risky contract clause.

**Risk Type:** {risk_type}
**Confidence:** {confidence:.1%}

**Clause:**
{clause_text}

Provide:
1. WHY this clause is risky (2-3 sentences)
2. WHAT problems it could cause (2-3 sentences)
3. WHO is disadvantaged (1-2 sentences)
4. SUGGESTED redlined version
5. ALTERNATIVE approach"""
        
        try:
            response = self.llm.invoke([HumanMessage(content=prompt)])
            
            return {
                'chunk_id': chunk['chunk_id'],
                'original_clause': clause_text,
                'risk_detection': {
                    'risk_type': risk_type,
                    'confidence': confidence
                },
                'llm_analysis': response.content.strip(),
                'timestamp': datetime.now().isoformat()
            }
        except Exception as e:
            return {
                'chunk_id': chunk['chunk_id'],
                'error': str(e),
                'original_clause': clause_text,
                'risk_detection': {
                    'risk_type': risk_type,
                    'confidence': confidence
                }
            }
    
    def generate_advisories(self, risky_chunks: List[Dict]) -> List[Dict]:
        """Generate advisories for all risky chunks"""
        print(f"\nGenerating LLM advisories for {len(risky_chunks)} risky chunks...\n")
        
        advisories = []
        for i, chunk in enumerate(risky_chunks, 1):
            print(f"[{i}/{len(risky_chunks)}] Analyzing {chunk['prediction']['label']}...")
            advisory = self.analyze_risk(chunk)
            advisories.append(advisory)
        
        print(f"\n✓ Generated {len(advisories)} advisories\n")
        return advisories


# ============================================================================
# ENHANCED RAG WITH STORED ADVISORIES
# ============================================================================

class EnhancedRAGSystem:
    """RAG system that ALWAYS shows detected risks first"""
    
    def __init__(self, vector_db_path: str, advisories: List[Dict], doc_name: str):
        print("\nInitializing Enhanced RAG system...")
        
        # LLM
        self.llm = ChatOpenAI(
            model=Config.LLM_MODEL,
            openai_api_key=Config.OPENAI_API_KEY,
            openai_api_base=Config.OPENAI_API_BASE,
            temperature=0.7
        )
        
        # Embeddings
        self.embeddings = HuggingFaceEndpointEmbeddings(
            repo_id=Config.EMBEDDING_MODEL,
            task="feature-extraction",
            huggingfacehub_api_token=Config.HF_TOKEN
        )
        
        # Load vector store
        print("✓ Loading vector database...")
        self.vectorstore = FAISS.load_local(
            vector_db_path,
            self.embeddings,
            allow_dangerous_deserialization=True
        )
        
        # Store advisories in memory (CRITICAL FIX)
        self.detected_risks = advisories
        self.doc_name = doc_name
        
        print(f"✓ Stored {len(advisories)} detected risks in memory")
        print("✓ Enhanced RAG system ready\n")
    
    def chat(self, user_query: str, chat_history: List = None) -> str:
        """Chat that ALWAYS prioritizes detected risks"""
        
        # Check if asking about risks
        risk_keywords = ['risk', 'risky', 'danger', 'problem', 'issue', 'concern', 'warning']
        is_risk_query = any(keyword in user_query.lower() for keyword in risk_keywords)
        
        # Retrieve contract context
        contract_docs = self.vectorstore.similarity_search(user_query, k=4)
        contract_context = "\n\n".join([doc.page_content for doc in contract_docs])
        
        # Build prompt based on query type
        if is_risk_query and self.detected_risks:
            # Build detected risks summary
            detected_risks_text = []
            for i, adv in enumerate(self.detected_risks, 1):
                if "error" in adv:
                    continue

                # Support both full advisories (with 'risk_detection') and
                # raw risky chunks (with 'prediction' + 'text')
                risk_detection = adv.get("risk_detection") or {
                    "risk_type": adv.get("prediction", {}).get("label", "Unknown"),
                    "confidence": adv.get("prediction", {}).get("confidence", 0.0),
                }
                risk_type = risk_detection.get("risk_type", "Unknown")
                confidence = risk_detection.get("confidence", 0.0)
                chunk_id = adv.get("chunk_id", adv.get("id", "N/A"))
                original_clause = adv.get("original_clause") or adv.get("text", "N/A")
                llm_analysis = adv.get(
                    "llm_analysis",
                    "No stored detailed advisory for this clause. Summarize why this clause is risky and what the parties should negotiate.",
                )

                risk_summary = f"""
═══════════════════════════════════════════════════════════════════════
MAJOR RISK #{i} (AI-DETECTED)
═══════════════════════════════════════════════════════════════════════

Risk Type: {risk_type}
Confidence: {confidence:.1%}
Chunk ID: {chunk_id}

ORIGINAL RISKY CLAUSE:
───────────────────────────────────────────────────────────────────────
{original_clause}
───────────────────────────────────────────────────────────────────────

DETAILED ANALYSIS:
{llm_analysis}
"""
                detected_risks_text.append(risk_summary)
            
            system_msg = f"""You are an expert legal advisor analyzing a contract.

{'='*70}
AI-DETECTED MAJOR RISKS (THESE MUST BE MENTIONED FIRST!)
{'='*70}

{chr(10).join(detected_risks_text)}

{'='*70}
ADDITIONAL CONTRACT CONTEXT (For finding other potential risks)
{'='*70}
{contract_context}

{'='*70}
INSTRUCTIONS FOR YOUR RESPONSE:
{'='*70}

When the user asks about risks, you MUST:

1. **FIRST:** List ALL the MAJOR RISKS detected by the AI model above
   - Include the risk type, confidence, and chunk ID
   - Show the original risky clause
   - Explain the analysis

2. **THEN:** Analyze the additional contract context for any OTHER risks not detected by AI
   - Clearly label these as "Additional Potential Risks (Not AI-Detected)"
   - Explain why these might also be concerning

3. **FORMAT:** Use clear sections:
   - "🚨 MAJOR RISKS DETECTED BY AI MODEL"
   - "⚠️ ADDITIONAL POTENTIAL RISKS"

Answer the user's question following these instructions:"""
        
        else:
            # Normal query (not about risks)
            system_msg = f"""You are an expert legal advisor analyzing a contract.

Contract Context:
{contract_context}

Answer the user's question based on this context:"""
        
        # Add chat history
        messages = [SystemMessage(content=system_msg)]
        if chat_history:
            messages.extend(chat_history[-6:])
        messages.append(HumanMessage(content=user_query))
        
        # Get response
        response = self.llm.invoke(messages)
        return response.content


# ============================================================================
# REPORT GENERATION
# ============================================================================

def generate_safe_report(total_chunks: int) -> str:
    """Generate safe contract report"""
    return f"""## CONTRACT RISK ANALYSIS REPORT

**Generated:** {datetime.now().strftime('%B %d, %Y at %I:%M %p')}  
**Total Chunks Analyzed:** {total_chunks}

---

## ✅ RESULT: SAFE CONTRACT

### 🎉 Good News!

No significant risks detected in this contract.

### What This Means:

- **No unilateral termination clauses** - Termination terms appear balanced
- **No unlimited liability provisions** - Liability exposure is capped appropriately
- **No excessive non-compete restrictions** - Restrictions are reasonable in scope

---

### ⚖️ Disclaimer

This is an AI-generated analysis based on automated risk detection models. While the system has high accuracy in identifying common legal risks, it is recommended to consult with a qualified legal professional for a complete review of this contract. AI analysis complements but does not replace professional legal advice.

---
"""


def generate_risky_report(advisories: List[Dict], source_name: str) -> str:
    """Generate risky contract report with professional formatting"""
    lines = []
    
    # Header
    lines.append("## CONTRACT RISK ANALYSIS REPORT")
    lines.append("")
    lines.append(f"**Document:** {source_name}")
    lines.append(f"**Generated:** {datetime.now().strftime('%B %d, %Y at %I:%M %p')}")
    lines.append(f"**Total Risks Found:** {len(advisories)}")
    lines.append("")
    lines.append("---")
    lines.append("")
    
    # Risk Summary Section
    lines.append("## 🚨 IDENTIFIED RISKS")
    lines.append("")
    lines.append(f"This contract contains **{len(advisories)} significant risk(s)** that require attention:")
    lines.append("")
    
    # Risk listing with confidence levels
    for i, advisory in enumerate(advisories, 1):
        if 'error' not in advisory:
            risk_type = advisory.get('risk_detection', {}).get('risk_type', 'Unknown Risk')
            confidence = advisory.get('risk_detection', {}).get('confidence', 0.0)
            
            # Create risk summary line
            risk_level = "HIGH" if confidence > 0.8 else "MEDIUM" if confidence > 0.6 else "ELEVATED"
            lines.append(f"**{i}. {risk_type}** [{risk_level} CONFIDENCE: {confidence:.1%}]")
    
    lines.append("")
    lines.append("---")
    lines.append("")
    
    # Detailed Risk Analysis
    lines.append("## 📋 DETAILED RISK ANALYSIS")
    lines.append("")
    
    for i, advisory in enumerate(advisories, 1):
        if 'error' in advisory:
            lines.append(f"### Risk #{i}: {advisory['risk_detection']['risk_type']}")
            lines.append("")
            lines.append(f"⚠️ **Analysis Status:** {advisory['error']}")
            lines.append("")
            lines.append("---")
            lines.append("")
            continue
        
        risk_type = advisory['risk_detection']['risk_type']
        confidence = advisory['risk_detection']['confidence']
        chunk_id = advisory['chunk_id']
        original_clause = advisory.get('original_clause', 'N/A')
        llm_analysis = advisory['llm_analysis']
        
        # Risk header
        lines.append(f"### Risk #{i}: {risk_type}")
        lines.append("")
        
        # Confidence and ID
        lines.append(f"**Confidence Level:** {confidence:.1%}")
        lines.append(f"**Reference ID:** {chunk_id}")
        lines.append("")
        
        # Original Clause Section
        lines.append("#### 📄 Original Risky Clause")
        lines.append("")
        lines.append("```")
        lines.append(original_clause)
        lines.append("```")
        lines.append("")
        
        # Analysis Section
        lines.append("#### 🔍 Detailed Analysis")
        lines.append("")
        lines.append(llm_analysis)
        lines.append("")
        
        lines.append("---")
        lines.append("")
    
    # Conclusion
    lines.append("## ⚖️ Important Disclaimer")
    lines.append("")
    lines.append("**This is an AI-generated legal analysis.** While the system has been trained on extensive legal documentation and achieves high accuracy in identifying common contract risks, it should not be considered a substitute for professional legal counsel.")
    lines.append("")
    lines.append("### Recommendations:")
    lines.append("- **Review with Legal Professional:** Consult with a qualified attorney licensed in your jurisdiction")
    lines.append("- **Negotiate Key Terms:** Use the identified risks as a starting point for negotiations")
    lines.append("- **Verify Compliance:** Ensure all recommendations comply with applicable laws and regulations")
    lines.append("- **Consider Context:** This analysis is automated and may not account for specific business relationships or industry practices")
    lines.append("")
    lines.append("---")
    lines.append(f"**Report Generated:** {datetime.now().strftime('%B %d, %Y at %I:%M %p UTC')}")
    
    return "\n".join(lines)


# ============================================================================
# MAIN PIPELINE
# ============================================================================

class AdvisoryPipeline:
    """Complete advisory pipeline"""
    
    def __init__(self):
        Config.setup_directories()
    
    def process(self, risky_file: str, safe_file: str, 
                vector_db_path: str, enable_chat: bool = False):
        """Process: analyze → report → chat"""
        print(f"\n{'='*70}")
        print("LEGAL ADVISORY PIPELINE")
        print(f"{'='*70}\n")
        
        # Load chunks
        with open(risky_file, 'r', encoding='utf-8') as f:
            risky_chunks = json.load(f)
        with open(safe_file, 'r', encoding='utf-8') as f:
            safe_chunks = json.load(f)
        
        total_chunks = len(risky_chunks) + len(safe_chunks)
        doc_name = Path(risky_file).stem.replace('_risky_', '').split('_')[0]
        
        print(f"Risky: {len(risky_chunks)}")
        print(f"Safe: {len(safe_chunks)}")
        print(f"Total: {total_chunks}\n")
        
        # Generate report
        advisories = []
        if not risky_chunks:
            report_content = generate_safe_report(total_chunks)
        else:
            generator = AdvisoryGenerator()
            advisories = generator.generate_advisories(risky_chunks)
            report_content = generate_risky_report(advisories, doc_name)
        
        # Save report
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_path = os.path.join(
            Config.REPORTS_DIR,
            f"{doc_name}_report_{timestamp}.txt"
        )
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        print(f"✓ Report saved: {report_path}\n")
        
        # Interactive chat
        if enable_chat:
            print("Starting enhanced chat...\n")
            rag = EnhancedRAGSystem(vector_db_path, advisories, doc_name)
            chat_history = [SystemMessage(content=f"Analyzing: {doc_name}")]
            
            print(f"{'='*70}")
            print("CONTRACT CHAT (type 'exit' to quit)")
            print(f"{'='*70}\n")
            
            while True:
                user_input = input("You: ").strip()
                
                if user_input.lower() in ['exit', 'quit']:
                    print("\n✓ Chat ended\n")
                    break
                
                if not user_input:
                    continue
                
                chat_history.append(HumanMessage(content=user_input))
                response = rag.chat(user_input, chat_history)
                chat_history.append(AIMessage(content=response))
                
                print(f"\nAssistant: {response}\n")
        
        return report_path


# ============================================================================
# USAGE
# ============================================================================

if __name__ == "__main__":
    pipeline = AdvisoryPipeline()
    
    # Auto-detect files
    risky_files = list(Path(Config.RISKY_CHUNKS_DIR).glob("*_risky_*.json"))
    safe_files = list(Path(Config.SAFE_CHUNKS_DIR).glob("*_safe_*.json"))
    vector_dbs = list(Path(Config.VECTOR_DB_DIR).glob("*_faiss_index"))
    
    if not risky_files or not safe_files or not vector_dbs:
        print("❌ Missing files! Run Stage 1 and 2 first.")
    else:
        latest_risky = max(risky_files, key=os.path.getctime)
        latest_safe = max(safe_files, key=os.path.getctime)
        latest_vector_db = max(vector_dbs, key=os.path.getctime)
        
        print(f"Processing:")
        print(f"  Risky: {latest_risky.name}")
        print(f"  Safe: {latest_safe.name}")
        print(f"  Vector DB: {latest_vector_db.name}")
        
        try:
            report_path = pipeline.process(
                str(latest_risky),
                str(latest_safe),
                str(latest_vector_db),
                enable_chat=True
            )
            
            print(f"✅ Complete! Report: {report_path}")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()
