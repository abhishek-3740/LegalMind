"""
app.py - HuggingFace Spaces Entry Point
This wrapper starts the FastAPI application on port 7860 (HF Spaces default)
"""

import os
import sys
import uvicorn
from pathlib import Path

# Add the backend directory to Python path
sys.path.insert(0, str(Path(__file__).parent))

# Set environment variables for HF Spaces
os.environ.setdefault("PORT", "7860")
os.environ.setdefault("HOST", "0.0.0.0")

# Import the FastAPI app
from main import app

def main():
    """Start the FastAPI server"""
    port = int(os.getenv("PORT", 7860))
    host = os.getenv("HOST", "0.0.0.0")
    
    print(f"\n{'='*70}")
    print("🚀 LEGALMIND BACKEND - HUGGINGFACE SPACES")
    print(f"{'='*70}")
    print(f"Host: {host}")
    print(f"Port: {port}")
    print(f"{'='*70}\n")
    
    uvicorn.run(
        app,
        host=host,
        port=port,
        log_level="info"
    )

if __name__ == "__main__":
    main()
