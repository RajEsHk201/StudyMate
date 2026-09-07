import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root or backend directory
BASE_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BASE_DIR / ".env")
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

class Config:
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    
    # AI Models
    TEXT_MODEL = os.getenv("STUDYMATE_MODEL", "openai/gpt-oss-120b")
    VISION_MODEL = os.getenv("STUDYMATE_VISION_MODEL", "qwen/qwen3.6-27b")
    
    # Storage & Database
    DATA_DIR = BASE_DIR / "data"
    DB_PATH = os.getenv("STUDYMATE_DB_PATH", str(BASE_DIR / "backend" / "studymate.db"))
    
    # Upload settings
    MAX_CONTENT_LENGTH = 20 * 1024 * 1024  # 20 MB
    ALLOWED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
    ALLOWED_DOCUMENT_EXTENSIONS = {"pdf", "docx", "txt", "pptx"}
    
    # Frontend directory
    FRONTEND_DIR = str(BASE_DIR / "frontend")
