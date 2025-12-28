"""
stage2_risk_detector.py
=======================
Stage 2: Contract Risk Detection using 97.74% Accuracy Ensemble Model
Integrates with Document_loader.py output
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import List, Dict
import sys
from huggingface_hub import snapshot_download


# ============================================================================
# CONFIGURATION
# ============================================================================

class Config:
    """Configuration for risk detection pipeline"""
    
    # Paths (match Document_loader.py)
    RAW_CHUNKS_DIR = "rag_storage/raw_chunks"
    RESULTS_DIR = "risk_analysis_results"
    RISKY_CHUNKS_DIR = os.path.join(RESULTS_DIR, "risky_chunks")
    SAFE_CHUNKS_DIR = os.path.join(RESULTS_DIR, "safe_chunks")
    
    # Model Settings
    ENSEMBLE_REPO_ID = "Nikhil-AI-Labs/legal-contract-classifier-best"
    MODEL_CACHE_DIR = "./hf_model_cache"
    DEVICE = "auto"
    
    # Risk Detection Settings
    CONFIDENCE_THRESHOLD = 0.70
    
    @classmethod
    def setup_directories(cls):
        """Create necessary directories"""
        os.makedirs(cls.RISKY_CHUNKS_DIR, exist_ok=True)
        os.makedirs(cls.SAFE_CHUNKS_DIR, exist_ok=True)


# ============================================================================
# STAGE 2: LOAD AND PREDICT
# ============================================================================

class RiskDetectionPipeline:
    """Main pipeline for risk detection"""
    
    def __init__(self):
        Config.setup_directories()
        self._load_model()
    
    def _load_model(self):
        """Load ensemble model from HuggingFace"""
        print(f"\n{'='*70}")
        print("LOADING ENSEMBLE MODEL (97.74% Accuracy)")
        print(f"{'='*70}\n")
        
        # Disable symlinks for Windows compatibility
        os.environ['HF_HUB_DISABLE_SYMLINKS'] = '1'
        os.environ['HF_HUB_DISABLE_SYMLINKS_WARNING'] = '1'
        
        try:
            # First attempt: Use cached model (no download)
            print("Checking for cached model...")
            self.model_dir = snapshot_download(
                repo_id=Config.ENSEMBLE_REPO_ID,
                cache_dir=Config.MODEL_CACHE_DIR,
                local_files_only=True,  # Only use cache, don't download
                resume_download=True
            )
            print("✓ Using cached model\n")
            
        except Exception as cache_error:
            # Cache not found, download the model
            print(f"Cached model not found. Downloading... (this may take 5-10 minutes)")
            print("Please wait and do NOT interrupt.\n")
            
            try:
                self.model_dir = snapshot_download(
                    repo_id=Config.ENSEMBLE_REPO_ID,
                    cache_dir=Config.MODEL_CACHE_DIR,
                    local_files_only=False,  # Allow download
                    resume_download=True  # Resume if interrupted
                )
                print("✓ Model downloaded successfully\n")
                
            except Exception as download_error:
                print(f"❌ Model download failed: {download_error}")
                raise
        
        # Load ensemble
        sys.path.insert(0, self.model_dir)
        from ensemble_model import SimpleLegalEnsemble
        
        self.ensemble = SimpleLegalEnsemble(
            model_dir=self.model_dir,
            device=Config.DEVICE
        )
        
        print("✓ Model loaded successfully\n")

    
    def process_chunks(self, chunks_file: str) -> Dict:
        """
        Load chunks, detect risks, save results
        
        Args:
            chunks_file: Path to chunks JSON from Document_loader.py
        
        Returns:
            Dictionary with file paths and statistics
        """
        print(f"{'='*70}")
        print("RISK DETECTION PIPELINE")
        print(f"{'='*70}\n")
        
        # Load chunks
        with open(chunks_file, 'r', encoding='utf-8') as f:
            chunks = json.load(f)
        
        print(f"Loaded {len(chunks)} chunks\n")
        
        # Detect risks
        risky_chunks = []
        safe_chunks = []
        
        print("Analyzing chunks...")
        for i, chunk in enumerate(chunks):
            # Predict
            result = self.ensemble.predict(chunk['text'])
            
            # Add prediction to chunk
            chunk['prediction'] = {
                'label': result['label'],
                'label_id': result['label_id'],
                'confidence': result['confidence']
            }
            
            # Categorize (0 = Safe, anything else = Risky)
            is_risky = (result['label_id'] != 0 and 
                       result['confidence'] >= Config.CONFIDENCE_THRESHOLD)
            
            if is_risky:
                risky_chunks.append(chunk)
                print(f"  Chunk {i}: 🚨 {result['label']} ({result['confidence']:.1%})")
            else:
                safe_chunks.append(chunk)
        
        print(f"\n✓ Analysis complete: {len(risky_chunks)} risky, {len(safe_chunks)} safe\n")
        
        # Save results
        doc_name = Path(chunks_file).stem.replace('_chunks', '')
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save risky chunks
        risky_path = os.path.join(
            Config.RISKY_CHUNKS_DIR,
            f"{doc_name}_risky_{timestamp}.json"
        )
        with open(risky_path, 'w', encoding='utf-8') as f:
            json.dump(risky_chunks, f, indent=2, ensure_ascii=False)
        
        # Save safe chunks
        safe_path = os.path.join(
            Config.SAFE_CHUNKS_DIR,
            f"{doc_name}_safe_{timestamp}.json"
        )
        with open(safe_path, 'w', encoding='utf-8') as f:
            json.dump(safe_chunks, f, indent=2, ensure_ascii=False)
        
        # Delete original chunks file
        os.remove(chunks_file)
        print(f"✓ Deleted original chunks file: {chunks_file}")
        
        print(f"\n{'='*70}")
        print("RESULTS SAVED")
        print(f"{'='*70}")
        print(f"Risky chunks: {risky_path}")
        print(f"Safe chunks:  {safe_path}\n")
        
        return {
            'risky_chunks_file': risky_path,
            'safe_chunks_file': safe_path,
            'risky_count': len(risky_chunks),
            'safe_count': len(safe_chunks),
            'total_chunks': len(chunks)
        }


# ============================================================================
# USAGE EXAMPLE
# ============================================================================

if __name__ == "__main__":
    pipeline = RiskDetectionPipeline()
    
    # Get latest chunks file from Document_loader.py output
    chunks_dir = "rag_storage\raw_chunks"
    chunks_files = list(Path(chunks_dir).glob("*_chunks.json"))
    
    if not chunks_files:
        print("❌ No chunks files found!")
        print(f"   Run Document_loader.py first to generate chunks in: {chunks_dir}")
    else:
        # Use most recent chunks file
        latest_chunks = max(chunks_files, key=os.path.getctime)
        
        print(f"Processing: {latest_chunks.name}\n")
        
        try:
            result = pipeline.process_chunks(str(latest_chunks))
            
            print(f"✅ SUCCESS!")
            print(f"   Risky: {result['risky_count']}/{result['total_chunks']}")
            print(f"   Safe: {result['safe_count']}/{result['total_chunks']}")
            
        except Exception as e:
            print(f"❌ Error: {e}")
            import traceback
            traceback.print_exc()