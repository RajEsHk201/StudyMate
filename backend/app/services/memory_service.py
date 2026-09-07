from ..db import db_session

class MemoryService:
    # --- USER PROFILE & PERSONALIZATION ---
    @staticmethod
    def get_or_create_user(email, name="Student"):
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            row = cursor.fetchone()
            if row:
                return dict(row)
            
            cursor.execute("""
                INSERT INTO users (email, name)
                VALUES (?, ?)
            """, (email, name))
            user_id = cursor.lastrowid
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            return dict(cursor.fetchone())

    @staticmethod
    def update_user_profile(user_id, profile_data):
        fields = [
            "name", "education_level", "major", "target_exam",
            "exam_date", "learning_style", "tutor_mode"
        ]
        updates = []
        values = []
        for f in fields:
            if f in profile_data:
                updates.append(f"{f} = ?")
                values.append(profile_data[f])
        
        if not updates:
            return None

        values.append(user_id)
        query = f"UPDATE users SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute(query, values)
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            return dict(cursor.fetchone())

    # --- SESSION MANAGEMENT ---
    @staticmethod
    def create_session(user_id, title="New Study Session", session_type="Free Study"):
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO sessions (user_id, title, session_type)
                VALUES (?, ?, ?)
            """, (user_id, title, session_type))
            session_id = cursor.lastrowid
            cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
            return dict(cursor.fetchone())

    @staticmethod
    def get_sessions(user_id):
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT s.*, COUNT(m.id) as message_count
                FROM sessions s
                LEFT JOIN messages m ON s.id = m.session_id
                WHERE s.user_id = ? OR s.user_id IS NULL
                GROUP BY s.id
                ORDER BY s.updated_at DESC
            """, (user_id,))
            return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def get_session(session_id):
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    @staticmethod
    def delete_session(session_id):
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
            return True

    # --- CONVERSATION MEMORY ---
    @staticmethod
    def save_message(session_id, role, content, mode="notes"):
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO messages (session_id, role, content, mode)
                VALUES (?, ?, ?, ?)
            """, (session_id, role, content, mode))
            cursor.execute("UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (session_id,))
            return cursor.lastrowid

    @staticmethod
    def get_messages(session_id, limit=50):
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM messages
                WHERE session_id = ?
                ORDER BY timestamp ASC
                LIMIT ?
            """, (session_id, limit))
            return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def get_recent_history(session_id, max_turns=8):
        """Retrieve recent turns formatted for the LLM conversation window."""
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT role, content FROM messages
                WHERE session_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            """, (session_id, max_turns * 2))
            rows = cursor.fetchall()
            # Reverse to chronological order
            history = []
            for r in reversed(rows):
                history.append({
                    "role": "assistant" if r["role"] == "assistant" else "user",
                    "content": r["content"]
                })
            return history

    # --- MISTAKE VAULT & WEAKNESS MEMORY ---
    @staticmethod
    def get_mistake_vault(user_id, status="needs_review"):
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT * FROM mistake_vault
                WHERE (user_id = ? OR user_id IS NULL) AND (status = ? OR ? = 'all')
                ORDER BY created_at DESC
            """, (user_id, status, status))
            return [dict(row) for row in cursor.fetchall()]

    @staticmethod
    def resolve_mistake(mistake_id):
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE mistake_vault SET status = 'mastered' WHERE id = ?", (mistake_id,))
            return True
