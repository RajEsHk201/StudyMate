"""
StudyMate AI - Main Application Runner
Backward-compatibility wrapper around app.create_app()
"""
import os
import sys
from pathlib import Path

# Ensure backend root is in sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from app import create_app

app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    print(f"StudyMate AI server running on http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
