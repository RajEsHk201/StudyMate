from flask import Blueprint, request, jsonify
from ..services.groq_service import GroqService
from ..services.tutor_service import TutorService
from ..services.memory_service import MemoryService

chat_bp = Blueprint("chat", __name__)

@chat_bp.route("/api/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json() or {}
        topic = data.get("topic", "").strip()
        mode = data.get("mode", "notes")
        session_id = data.get("session_id")
        user_email = data.get("user_email")

        if not topic:
            return jsonify({"error": "Please enter a topic or question."}), 400

        # Retrieve user profile if available
        user = None
        weak_concepts = []
        if user_email:
            user = MemoryService.get_or_create_user(user_email)
            weak_concepts = MemoryService.get_mistake_vault(user["id"])

        # Ensure session exists or create one
        if not session_id and user:
            new_session = MemoryService.create_session(user["id"], title=topic[:35] or "Study Session")
            session_id = new_session["id"]

        session_type = "Free Study"
        if session_id:
            s = MemoryService.get_session(session_id)
            if s:
                session_type = s.get("session_type", "Free Study")

        # Build personalized system prompt
        system_instruction = TutorService.build_system_prompt(
            profile=user,
            session_type=session_type,
            weak_concepts=weak_concepts
        )

        # Retrieve multi-turn conversation memory
        history = []
        if session_id:
            history = MemoryService.get_recent_history(session_id, max_turns=6)

        mode_prompt = TutorService.get_mode_prompt(mode, topic)

        messages = [{"role": "system", "content": system_instruction}]
        messages.extend(history)
        messages.append({"role": "user", "content": mode_prompt})

        # Generate response from Groq
        result = GroqService.chat_completion(messages)

        # Save turn in conversation memory
        if session_id:
            MemoryService.save_message(session_id, "user", topic, mode)
            MemoryService.save_message(session_id, "assistant", result, mode)

        return jsonify({
            "result": result,
            "session_id": session_id
        })

    except Exception as e:
        print("Chat Generation Error:", e)
        return jsonify({
            "error": "Failed to generate study response.",
            "details": str(e)
        }), 500

# Legacy route for backward compatibility
@chat_bp.route("/generate", methods=["POST"])
def legacy_generate():
    return chat()

# --- SESSIONS API ---
@chat_bp.route("/api/sessions", methods=["GET"])
def list_sessions():
    user_email = request.args.get("user_email")
    user_id = None
    if user_email:
        user = MemoryService.get_or_create_user(user_email)
        user_id = user["id"]
    sessions = MemoryService.get_sessions(user_id)
    return jsonify({"sessions": sessions})

@chat_bp.route("/api/sessions", methods=["POST"])
def create_session():
    data = request.get_json() or {}
    title = data.get("title", "New Study Session")
    session_type = data.get("session_type", "Free Study")
    user_email = data.get("user_email")
    
    user_id = None
    if user_email:
        user = MemoryService.get_or_create_user(user_email)
        user_id = user["id"]
        
    session = MemoryService.create_session(user_id, title=title, session_type=session_type)
    return jsonify({"session": session})

@chat_bp.route("/api/sessions/<int:session_id>/messages", methods=["GET"])
def get_session_messages(session_id):
    messages = MemoryService.get_messages(session_id)
    return jsonify({"messages": messages})

@chat_bp.route("/api/sessions/<int:session_id>", methods=["DELETE"])
def delete_session(session_id):
    MemoryService.delete_session(session_id)
    return jsonify({"success": True})
