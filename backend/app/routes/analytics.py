from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from ..services.memory_service import MemoryService
from ..db import db_session

analytics_bp = Blueprint("analytics", __name__)

@analytics_bp.route("/api/analytics/focus-log", methods=["POST"])
def log_focus():
    try:
        data = request.get_json() or {}
        user_email = data.get("user_email")
        subject = data.get("subject", "General Study").strip()
        duration = int(data.get("duration_minutes", 25))

        user = MemoryService.get_or_create_user(user_email) if user_email else None
        user_id = user["id"] if user else None

        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO focus_logs (user_id, subject, duration_minutes)
                VALUES (?, ?, ?)
            """, (user_id, subject, duration))
            return jsonify({"success": True, "subject": subject, "duration_minutes": duration})

    except Exception as e:
        print("Analytics Log Error:", e)
        return jsonify({"error": "Failed to log focus session.", "details": str(e)}), 500

@analytics_bp.route("/api/analytics/stats", methods=["GET"])
def get_stats():
    user_email = request.args.get("user_email")
    user = MemoryService.get_or_create_user(user_email) if user_email else None
    user_id = user["id"] if user else None

    today = datetime.now().strftime("%Y-%m-%d")

    with db_session() as conn:
        cursor = conn.cursor()

        # Today's focus minutes
        cursor.execute("""
            SELECT COALESCE(SUM(duration_minutes), 0) FROM focus_logs
            WHERE (user_id = ? OR user_id IS NULL) AND DATE(completed_at) = ?
        """, (user_id, today))
        today_focus_mins = cursor.fetchone()[0]

        # Total focus hours
        cursor.execute("""
            SELECT COALESCE(SUM(duration_minutes), 0) FROM focus_logs
            WHERE user_id = ? OR user_id IS NULL
        """, (user_id,))
        total_focus_mins = cursor.fetchone()[0]
        total_focus_hours = round(total_focus_mins / 60, 1)

        # Quizzes taken & average score
        cursor.execute("""
            SELECT COUNT(*), COALESCE(AVG(CAST(score AS FLOAT) / total_questions * 100), 0)
            FROM quiz_history
            WHERE user_id = ? OR user_id IS NULL
        """, (user_id,))
        q_count, avg_score = cursor.fetchone()

        # Cards reviewed count
        cursor.execute("""
            SELECT COUNT(*) FROM flashcards f
            JOIN flashcard_decks d ON f.deck_id = d.id
            WHERE (d.user_id = ? OR d.user_id IS NULL) AND f.repetition_n > 0
        """, (user_id,))
        cards_reviewed = cursor.fetchone()[0]

        # Calculate streak (consecutive days with activity)
        cursor.execute("""
            SELECT DISTINCT DATE(completed_at) as act_date FROM focus_logs
            WHERE user_id = ? OR user_id IS NULL
            UNION
            SELECT DISTINCT DATE(created_at) as act_date FROM quiz_history
            WHERE user_id = ? OR user_id IS NULL
            ORDER BY act_date DESC
        """, (user_id, user_id))
        dates = [r[0] for r in cursor.fetchall() if r[0]]

        streak = 0
        check_date = datetime.now().date()
        date_set = set(dates)

        # Check if active today or yesterday to maintain streak
        if today in date_set:
            streak = 1
            check_date -= timedelta(days=1)
            while check_date.strftime("%Y-%m-%d") in date_set:
                streak += 1
                check_date -= timedelta(days=1)
        elif (check_date - timedelta(days=1)).strftime("%Y-%m-%d") in date_set:
            check_date -= timedelta(days=1)
            while check_date.strftime("%Y-%m-%d") in date_set:
                streak += 1
                check_date -= timedelta(days=1)

        return jsonify({
            "today_focus_mins": today_focus_mins,
            "total_focus_hours": total_focus_hours,
            "quiz_count": q_count,
            "avg_quiz_score": round(avg_score, 1),
            "cards_reviewed": cards_reviewed,
            "study_streak": streak
        })
