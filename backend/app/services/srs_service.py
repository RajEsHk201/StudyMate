import json
import re
import math
from datetime import datetime, timedelta
from .groq_service import GroqService
from ..db import db_session

class SRSService:
    """
    Spaced Repetition System using the SuperMemo SM-2 algorithm.
    """

    @classmethod
    def calculate_sm2(cls, repetition_n, easiness_factor, interval_days, quality):
        """
        Calculates updated SM-2 parameters based on recall quality.
        Quality (q):
          0: Again (complete blackout)
          3: Hard (recalled with significant effort)
          4: Good (recalled with slight hesitation)
          5: Easy (perfect recall)
        """
        q = max(0, min(5, quality))
        
        if q < 3:
            # Failed recall -> reset repetition count and set interval to 1 day
            new_n = 0
            new_interval = 1
        else:
            # Successful recall
            if repetition_n == 0:
                new_interval = 1
            elif repetition_n == 1:
                new_interval = 6
            else:
                new_interval = math.ceil(interval_days * easiness_factor)
            new_n = repetition_n + 1

        # Calculate new easiness factor: EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        new_ef = easiness_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        new_ef = max(1.3, round(new_ef, 3))  # Minimum EF threshold is 1.3

        next_date = (datetime.now() + timedelta(days=new_interval)).strftime("%Y-%m-%d")
        return new_n, new_ef, new_interval, next_date

    @classmethod
    def generate_deck(cls, topic, num_cards=8, profile=None, context=None):
        profile = profile or {}
        level = profile.get("education_level", "Undergraduate")
        major = profile.get("major", "General Studies")
        
        context_str = f"\nSource Material:\n---\n{context[:10000]}\n---\n" if context else ""

        prompt = f"""You are a master educator specializing in high-retention flashcards for {level} {major} students.
Generate an active-recall flashcard deck on: "{topic}".{context_str}

Requirements:
1. Create exactly {num_cards} flashcards.
2. Front: Direct question, key concept, or formula to test.
3. Back: Clear, concise explanation or solution (ideal for 10-second recall).
4. Hint: Helpful clue or memory trigger.
5. Tag: Specific sub-concept.
6. Respond ONLY in valid JSON matching this schema:
{{
  "deck_title": "Flashcards: {topic}",
  "topic": "{topic}",
  "cards": [
    {{
      "front": "Front question/concept",
      "back": "Back concise answer",
      "hint": "Brief mnemonic or hint",
      "tag": "Subtopic"
    }}
  ]
}}"""

        messages = [
            {"role": "system", "content": "You are a flashcard generation engine. Output only strict JSON."},
            {"role": "user", "content": prompt}
        ]

        raw = GroqService.chat_completion(messages, temperature=0.6, json_mode=True)
        try:
            return json.loads(raw)
        except Exception:
            cleaned = re.sub(r"^```(?:json)?", "", raw.strip(), flags=re.IGNORECASE)
            cleaned = re.sub(r"```$", "", cleaned.strip())
            return json.loads(cleaned)

    @classmethod
    def save_deck_to_db(cls, user_id, title, topic, cards):
        today = datetime.now().strftime("%Y-%m-%d")
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO flashcard_decks (user_id, title, topic)
                VALUES (?, ?, ?)
            """, (user_id, title, topic))
            deck_id = cursor.lastrowid

            for c in cards:
                cursor.execute("""
                    INSERT INTO flashcards (
                        deck_id, front, back, hint, tag,
                        repetition_n, easiness_factor, interval_days, next_review_date
                    )
                    VALUES (?, ?, ?, ?, ?, 0, 2.5, 0, ?)
                """, (
                    deck_id,
                    c.get("front", ""),
                    c.get("back", ""),
                    c.get("hint", ""),
                    c.get("tag", topic),
                    today
                ))
            return deck_id

    @classmethod
    def review_card(cls, card_id, quality):
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM flashcards WHERE id = ?", (card_id,))
            card = cursor.fetchone()
            if not card:
                raise ValueError("Card not found")

            new_n, new_ef, new_interval, next_date = cls.calculate_sm2(
                card["repetition_n"],
                card["easiness_factor"],
                card["interval_days"],
                quality
            )

            cursor.execute("""
                UPDATE flashcards
                SET repetition_n = ?, easiness_factor = ?, interval_days = ?, next_review_date = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (new_n, new_ef, new_interval, next_date, card_id))

            return {
                "card_id": card_id,
                "repetition_n": new_n,
                "easiness_factor": new_ef,
                "interval_days": new_interval,
                "next_review_date": next_date
            }

    @classmethod
    def get_decks(cls, user_id):
        today = datetime.now().strftime("%Y-%m-%d")
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT d.*, 
                       COUNT(f.id) as total_cards,
                       SUM(CASE WHEN f.next_review_date <= ? THEN 1 ELSE 0 END) as due_cards
                FROM flashcard_decks d
                LEFT JOIN flashcards f ON d.id = f.deck_id
                WHERE d.user_id = ? OR d.user_id IS NULL
                GROUP BY d.id
                ORDER BY d.created_at DESC
            """, (today, user_id))
            return [dict(row) for row in cursor.fetchall()]

    @classmethod
    def get_deck_cards(cls, deck_id):
        with db_session() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM flashcards WHERE deck_id = ? ORDER BY id ASC", (deck_id,))
            return [dict(row) for row in cursor.fetchall()]
