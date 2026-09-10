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


@study_bp.route("/api/study/plan", methods=["POST"])
def generate_study_plan():
    try:
        data = request.get_json() or {}
        exam_target = data.get("exam_target", "Final Exams").strip()
        exam_date = data.get("exam_date", "")
        subjects = data.get("subjects", "").strip()
        hours_per_day = data.get("hours_per_day", 3)
        user_email = data.get("user_email")

        user = MemoryService.get_or_create_user(user_email) if user_email else None
        level = user.get("education_level", "Undergraduate") if user else "Undergraduate"
        major = user.get("major", "General") if user else "General"
        learning_style = user.get("learning_style", "Intuitive & Visual") if user else "Intuitive & Visual"

        prompt = f"""You are an elite academic coach and study strategist. Create a comprehensive, realistic, and highly motivating multi-phase study plan for a {level} student in {major}.

Exam / Target Goal: {exam_target}
Exam Date / Deadline: {exam_date if exam_date else "Approaching in 4-6 weeks"}
Key Subjects / Topics: {subjects if subjects else major}
Available Study Time: {hours_per_day} hours per day
Learning Style: {learning_style}

Produce a structured JSON response with this exact structure:
{{
  "headline": "Personalized Revision Roadmap: {exam_target}",
  "total_weeks": 4,
  "daily_focus_strategy": "Summary of how to structure daily {hours_per_day}-hour study blocks (e.g. 50m Deep Work + 10m Active Recall)",
  "phases": [
    {{
      "phase_num": 1,
      "title": "Phase 1: Foundational Mastery & Note Synthesis",
      "duration": "Weeks 1-2",
      "focus": "Core concepts and formula derivations",
      "weekly_milestones": [
        "Milestone 1 description",
        "Milestone 2 description",
        "Milestone 3 description"
      ],
      "active_recall_task": "Recommended quiz or flashcard routine"
    }},
    {{
      "phase_num": 2,
      "title": "Phase 2: Targeted Practice & Weak Spot Remediation",
      "duration": "Weeks 3-4",
      "focus": "Mistake Vault review, problem-solving, and exam question traps",
      "weekly_milestones": [
        "Milestone 1 description",
        "Milestone 2 description",
        "Milestone 3 description"
      ],
      "active_recall_task": "Weekly timed mock exam"
    }}
  ],
  "high_yield_tips": [
    "Tip 1 for memory retention",
    "Tip 2 for exam psychology",
    "Tip 3 for avoiding burnout"
  ]
}}"""

        messages = [
            {"role": "system", "content": "You are an expert AI study plan generator. Respond ONLY with valid JSON."},
            {"role": "user", "content": prompt}
        ]

        import json, re
        raw = GroqService.chat_completion(messages, temperature=0.5, json_mode=True)
        try:
            plan_data = json.loads(raw)
        except Exception:
            cleaned = re.sub(r"^```(?:json)?", "", raw.strip(), flags=re.IGNORECASE)
            cleaned = re.sub(r"```$", "", cleaned.strip())
            plan_data = json.loads(cleaned)

        return jsonify({"plan": plan_data})

    except Exception as e:
        print("Study Plan Generation Error:", e)
        return jsonify({"error": "Failed to generate study plan.", "details": str(e)}), 500


@study_bp.route("/api/study/mock-exam", methods=["POST"])
def generate_mock_exam():
    try:
        data = request.get_json() or {}
        topic = data.get("topic", "").strip()
        exam_type = data.get("exam_type", "Standard University Exam")
        duration = data.get("duration_minutes", 60)
        context = data.get("context", "")
        user_email = data.get("user_email")

        if not topic:
            return jsonify({"error": "Topic is required to generate a mock exam."}), 400

        user = MemoryService.get_or_create_user(user_email) if user_email else None
        level = user.get("education_level", "Undergraduate") if user else "Undergraduate"

        context_prompt = f"\nSource Material to draw questions from:\n{context[:12000]}\n" if context else ""

        prompt = f"""You are a senior university professor and exam paper setter.
Create a formal, complete, high-quality Mock Examination Paper for {level} level on the subject: "{topic}".
Target Duration: {duration} Minutes.{context_prompt}

Generate a comprehensive exam paper in markdown format with the following exact structure:

# 📋 MOCK EXAMINATION PAPER
**Subject:** {topic}  
**Level:** {level}  
**Time Allowed:** {duration} Minutes | **Total Marks:** 100 Marks

---

### SECTION A: Multiple Choice Questions (20 Marks — 5 Questions, 4 Marks each)
(Provide 5 rigorous multiple choice questions with options A, B, C, D)

---

### SECTION B: Short Answer & Conceptual Explanations (40 Marks — 4 Questions, 10 Marks each)
(Provide 4 questions requiring step-by-step explanations, formula derivations, or conceptual comparisons)

---

### SECTION C: Deep Application & Problem Solving (40 Marks — 2 Questions, 20 Marks each)
(Provide 2 comprehensive scenario-based questions or worked problems)

---

# 📝 MARKING SCHEME & MODEL SOLUTIONS
(Provide complete answers, step-by-step solutions, mark breakdowns, and common mistakes students make for Sections A, B, and C)
"""

        messages = [
            {"role": "system", "content": "You are a university examination board author. Write rigorous, beautifully formatted markdown exam papers with clear marking schemes."},
            {"role": "user", "content": prompt}
        ]

        result = GroqService.chat_completion(messages, temperature=0.5)
        return jsonify({"topic": topic, "paper_markdown": result})

    except Exception as e:
        print("Mock Exam Generation Error:", e)
        return jsonify({"error": "Failed to generate mock exam.", "details": str(e)}), 500

