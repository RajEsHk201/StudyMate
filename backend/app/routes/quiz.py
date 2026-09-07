from flask import Blueprint, request, jsonify
from ..services.quiz_service import QuizService
from ..services.memory_service import MemoryService
from ..db import db_session

quiz_bp = Blueprint("quiz", __name__)

@quiz_bp.route("/api/quiz/generate", methods=["POST"])
def generate_quiz():
    try:
        data = request.get_json() or {}
        topic = data.get("topic", "").strip()
        num_questions = int(data.get("num_questions", 5))
        difficulty = data.get("difficulty", "mixed")
        user_email = data.get("user_email")
        document_context = data.get("document_context")

        if not topic:
            return jsonify({"error": "Topic is required to generate a quiz."}), 400

        user = MemoryService.get_or_create_user(user_email) if user_email else None
        quiz_data = QuizService.generate_quiz(
            topic=topic,
            num_questions=min(max(num_questions, 3), 15),
            difficulty=difficulty,
            profile=user,
            document_context=document_context
        )
        return jsonify(quiz_data)

    except Exception as e:
        print("Quiz Generation Error:", e)
        return jsonify({"error": "Failed to generate quiz.", "details": str(e)}), 500

@quiz_bp.route("/api/quiz/submit", methods=["POST"])
def submit_quiz():
    try:
        data = request.get_json() or {}
        user_email = data.get("user_email")
        topic = data.get("topic", "General")
        score = int(data.get("score", 0))
        total = int(data.get("total_questions", 0))
        answers = data.get("answers", {})
        questions = data.get("questions", [])

        user = MemoryService.get_or_create_user(user_email) if user_email else None
        user_id = user["id"] if user else None

        result = QuizService.submit_quiz_results(
            user_id=user_id,
            topic=topic,
            score=score,
            total_questions=total,
            answers=answers,
            questions=questions
        )
        return jsonify(result)

    except Exception as e:
        print("Quiz Submission Error:", e)
        return jsonify({"error": "Failed to submit quiz results.", "details": str(e)}), 500

@quiz_bp.route("/api/quiz/history", methods=["GET"])
def quiz_history():
    user_email = request.args.get("user_email")
    if not user_email:
        return jsonify({"history": []})
    
    user = MemoryService.get_or_create_user(user_email)
    with db_session() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM quiz_history
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 20
        """, (user["id"],))
        rows = [dict(r) for r in cursor.fetchall()]
        return jsonify({"history": rows})
