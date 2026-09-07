from flask import Blueprint, request, jsonify
from ..config import Config
from ..services.groq_service import GroqService
from ..services.parser_service import ParserService
from ..services.tutor_service import TutorService
from ..services.memory_service import MemoryService

study_bp = Blueprint("study", __name__)

@study_bp.route("/api/study/analyze-image", methods=["POST"])
@study_bp.route("/analyze/image", methods=["POST"])
def analyze_image():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No image file uploaded."}), 400

        file = request.files["file"]
        if not file.filename:
            return jsonify({"error": "No image selected."}), 400

        ext = ParserService.get_extension(file.filename)
        if ext not in Config.ALLOWED_IMAGE_EXTENSIONS:
            return jsonify({"error": f"Unsupported image format: {ext}"}), 400

        image_bytes = file.read()
        if len(image_bytes) > Config.MAX_CONTENT_LENGTH:
            return jsonify({"error": "Image file exceeds 20MB limit."}), 400

        base64_image = ParserService.encode_image(image_bytes)
        user_prompt = request.form.get("prompt", "Analyze this image and explain the core educational concepts.").strip()
        user_email = request.form.get("user_email")

        # Personalization
        user = MemoryService.get_or_create_user(user_email) if user_email else None
        system_instruction = TutorService.build_system_prompt(profile=user)

        mime_map = {"png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg", "webp": "image/webp"}
        mime_type = mime_map.get(ext, "image/jpeg")

        full_prompt = f"""{system_instruction}

Uploaded Educational Image Analysis:
Student Query: {user_prompt}

Instructions:
- Carefully transcribe and interpret any handwritten notes, textbook pages, math formulas, or diagrams.
- Solve math or science problems step-by-step with clear explanations.
- Highlight key definitions, formulas, and likely exam questions based on this image.
- State clearly if any part is blurry or ambiguous."""

        result = GroqService.vision_completion(full_prompt, base64_image, mime_type=mime_type)
        return jsonify({"result": result})

    except Exception as e:
        print("Image Analysis Error:", e)
        return jsonify({"error": "Could not analyze the image.", "details": str(e)}), 500


@study_bp.route("/api/study/analyze-doc", methods=["POST"])
@study_bp.route("/analyze/document", methods=["POST"])
def analyze_document():
    try:
        if "file" not in request.files:
            return jsonify({"error": "No document file uploaded."}), 400

        file = request.files["file"]
        if not file.filename:
            return jsonify({"error": "No document selected."}), 400

        ext = ParserService.get_extension(file.filename)
        if ext not in Config.ALLOWED_DOCUMENT_EXTENSIONS:
            return jsonify({"error": f"Unsupported document format: {ext}"}), 400

        text = ParserService.extract_document_text(file, ext)
        if not text or not text.strip():
            return jsonify({"error": "Could not extract readable text from this document."}), 400

        user_prompt = request.form.get("prompt", "Analyze this document and extract key concepts.").strip()
        mode = request.form.get("mode", "notes")
        user_email = request.form.get("user_email")

        user = MemoryService.get_or_create_user(user_email) if user_email else None
        system_instruction = TutorService.build_system_prompt(profile=user)

        # Truncate safe context window (60,000 characters)
        truncated_text = text[:60000]
        if len(text) > 60000:
            truncated_text += "\n\n[Document excerpt limit reached. Focused on the first 60,000 characters.]"

        prompt = f"""Student uploaded a {ext.upper()} document.
Request: {user_prompt}
Target Output Mode: {mode.upper()}

Study Material Content:
----------------
{truncated_text}
----------------

Guidelines:
- Ground your response firmly in the provided study material.
- Organize with clear headings, bullet points, and key definition callouts.
- If the student asks for notes, build exam-ready structured notes.
- If the student asks for a summary, provide a concise high-yield breakdown.
- Highlight formulas, theorems, and definitions."""

        messages = [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": prompt}
        ]

        result = GroqService.chat_completion(messages)
        return jsonify({
            "result": result,
            "document_preview": truncated_text[:2000]  # Return preview snippet for potential quiz/flashcard generation
        })

    except Exception as e:
        print("Document Analysis Error:", e)
        return jsonify({"error": "Could not analyze the document.", "details": str(e)}), 500
