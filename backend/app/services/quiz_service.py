import json
import re
from .groq_service import GroqService
from .tutor_service import TutorService
from ..db import db_session

class QuizService:
    @classmethod
    def generate_quiz(cls, topic, num_questions=5, difficulty="mixed", profile=None, document_context=None):
        profile = profile or {}
        student_level = profile.get("education_level", "Undergraduate")
        major = profile.get("major", "General Studies")
        target_exam = profile.get("target_exam", "")

        context_snippet = ""
        if document_context:
            context_snippet = f"\n\nSource Study Material to base questions on:\n---\n{document_context[:12000]}\n---\n"

        prompt = f"""You are an expert exam creator for {student_level} students studying {major}.
Generate an interactive active-recall practice quiz on: "{topic}".{context_snippet}

Requirements:
1. Create exactly {num_questions} questions.
2. Difficulty: {difficulty}. Ensure questions test conceptual understanding, application, and problem solving, not pure trivia.
3. You MUST respond with ONLY a valid, parseable JSON object matching this schema:
{{
  "title": "Practice Quiz: {topic}",
  "topic": "{topic}",
  "questions": [
    {{
      "id": 1,
      "question": "Question text here",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "answer_index": 0,
      "explanation": "Detailed explanation of why Option A is correct and why other options are common pitfalls or incorrect.",
      "difficulty": "Medium",
      "concept_tag": "Specific Subtopic"
    }}
  ]
}}
Do NOT include any text outside the JSON object."""

        messages = [
            {"role": "system", "content": "You are a professional educational assessment engine. Respond only in strict JSON."},
            {"role": "user", "content": prompt}
        ]

        raw_content = GroqService.chat_completion(messages, temperature=0.5, json_mode=True)
        return cls._clean_and_parse_json(raw_content, topic, num_questions)

    @classmethod
    def _clean_and_parse_json(cls, raw_content, topic, num_questions):
        try:
            return json.loads(raw_content)
        except Exception:
            # Strip markdown fences if present
            cleaned = re.sub(r"^```(?:json)?", "", raw_content.strip(), flags=re.IGNORECASE)
            cleaned = re.sub(r"```$", "", cleaned.strip())
            try:
                return json.loads(cleaned)
            except Exception as e:
                # Fallback structure if LLM failed JSON formatting
                return {
                    "title": f"Practice Quiz: {topic}",
                    "topic": topic,
                    "error": "Failed to parse structured response",
                    "raw": raw_content,
                    "questions": []
                }

    @classmethod
    def submit_quiz_results(cls, user_id, topic, score, total_questions, answers, questions):
        """
        Record quiz score and automatically log incorrect answers to the student's Mistake Vault.
        """
        missed_concepts = []
        with db_session() as conn:
            cursor = conn.cursor()
            
            # Analyze mistakes
            for q in questions:
                q_id = q.get("id")
                chosen_idx = answers.get(str(q_id))
                correct_idx = q.get("answer_index")
                
                if chosen_idx is not None and chosen_idx != correct_idx:
                    concept = q.get("concept_tag", topic)
                    missed_concepts.append(concept)
                    
                    # Log mistake to vault
                    cursor.execute("""
                        INSERT INTO mistake_vault (user_id, topic, question, explanation, status)
                        VALUES (?, ?, ?, ?, 'needs_review')
                    """, (
                        user_id,
                        concept,
                        q.get("question", ""),
                        f"Correct Answer: {q.get('options', [])[correct_idx] if correct_idx < len(q.get('options', [])) else ''}. Explanation: {q.get('explanation', '')}"
                    ))
            
            # Record quiz attempt
            cursor.execute("""
                INSERT INTO quiz_history (user_id, topic, score, total_questions, missed_concepts)
                VALUES (?, ?, ?, ?, ?)
            """, (user_id, topic, score, total_questions, ", ".join(set(missed_concepts))))
            
            return {
                "score": score,
                "total": total_questions,
                "percentage": round((score / total_questions) * 100, 1) if total_questions > 0 else 0,
                "missed_count": len(missed_concepts),
                "missed_concepts": list(set(missed_concepts))
            }
