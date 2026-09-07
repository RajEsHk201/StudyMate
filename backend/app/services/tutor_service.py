import json

class TutorService:
    @staticmethod
    def build_system_prompt(profile=None, session_type="Free Study", weak_concepts=None):
        profile = profile or {}
        student_name = profile.get("name", "Student")
        education_level = profile.get("education_level", "Undergraduate")
        major = profile.get("major", "General Studies")
        target_exam = profile.get("target_exam", "")
        exam_date = profile.get("exam_date", "")
        learning_style = profile.get("learning_style", "Intuitive & Visual")
        tutor_mode = profile.get("tutor_mode", "Explanatory Tutor")

        # Persona instructions
        persona_guide = {
            "Socratic Mentor": "Do not simply give away full answers. Ask guiding questions, break problems into hints, and encourage the student to reach the solution step-by-step.",
            "Explanatory Tutor": "Provide clear, patient, and thoroughly structured explanations with intuitive analogies, bold key terms, and logical flow.",
            "Strict Exam Grader": "Evaluate like an official exam board examiner. Point out ambiguities, insist on precise technical definitions and mark-scheme precision, and highlight common exam traps."
        }.get(tutor_mode, "Provide clear, patient, and engaging explanations.")

        # Learning style adjustments
        style_guide = {
            "Intuitive & Visual": "Use concrete real-world analogies, ASCII diagrams, and visual metaphors to explain abstract ideas (the Feynman technique).",
            "Rigorous & Academic": "Use precise formal definitions, mathematical rigor, theorem formulations, and academic citations where applicable.",
            "Step-by-Step Problem Solving": "Break every concept down into numbered procedural steps, worked examples, and actionable formulas.",
            "High-Yield Exam Cramming": "Focus only on highest-yield topics likely to be tested, bullet points, memory mnemonics, and contrast tables."
        }.get(learning_style, "Explain clearly with relevant examples.")

        # Weakness injection
        weakness_note = ""
        if weak_concepts and len(weak_concepts) > 0:
            concepts_list = ", ".join([f"'{c['topic']}'" for c in weak_concepts[:5]])
            weakness_note = f"\n- NOTE ON STUDENT WEAKNESSES: The student previously struggled with: {concepts_list}. If any of these arise, pay extra attention to clarifying foundational misconceptions."

        exam_context = f" Target Exam: {target_exam} ({exam_date})." if target_exam else ""

        system_instruction = f"""You are StudyMate AI, a world-class personal study tutor dedicated to {student_name}.
Student Background:
- Level: {education_level}
- Field / Subject: {major}{exam_context}
- Learning Style: {learning_style} ({style_guide})
- Tutor Persona: {tutor_mode} ({persona_guide})
- Active Study Session: {session_type}{weakness_note}

Core Guidelines:
1. Always calibrate your technical depth to {student_name}'s level ({education_level} - {major}).
2. Use clear, beautifully structured Markdown (clean headings ## and ###, bullet points, bold key terms, tables where helpful).
3. Include practical exam tips, common misconceptions, and quick memory aids where helpful.
4. Keep the tone encouraging, focused, and scholarly.
5. CRITICAL - OUTPUT FORMAT: Provide ONLY the direct, polished study response for the student. NEVER output internal thoughts, thinking process, planning notes, reasoning traces, or meta-commentary (such as '<think>', 'Thinking Process:', or 'Here is a breakdown...'). Jump immediately into the formatted content."""

        return system_instruction

    @staticmethod
    def get_mode_prompt(mode, topic):
        prompts = {
            "notes": f"""Create structured, high-retention study notes on:
{topic}

Requirements:
- Organize with clean Markdown headings (## Topic Overview, ## Key Principles & Definitions, ## Detailed Breakdown, ## Common Exam Traps & Takeaways).
- Highlight definitions, formulas, and critical concepts in bold.
- Use comparison tables where comparing concepts.
- Include practical examples or case studies.
- End with high-yield key takeaways for rapid revision.
- Do NOT output any thought process or introductory chatter.""",

            "summary": f"""Provide a concise, high-yield summary of:
{topic}

Requirements:
- Condensed into 3-4 short sections for rapid review.
- Focus strictly on essentials and core definitions.
- Use bullet points and a comparison table if comparing concepts.
- Omit unnecessary fluff.""",

            "questions": f"""Generate realistic exam questions on:
{topic}

Requirements:
- 3 Short-Answer Conceptual Questions.
- 2 In-Depth Analytical / Problem-Solving Questions.
- 1 Challenging Edge-Case Question.
- Include marking scheme hints or what examiners look for.""",

            "mcq": f"""Create 10 high-quality multiple choice questions on:
{topic}

Requirements:
- Cover foundational, intermediate, and advanced analytical concepts.
- 4 options per question: A, B, C, D with only one correct answer.
- Distractors must be plausible common misconceptions.
- Clearly provide the correct answer and a brief explanation after each question.""",

            "simple": f"""Explain this concept using the Feynman Technique (as if explaining to a beginner or high-schooler):
{topic}

Requirements:
- Avoid unnecessary jargon; define unavoidable technical terms simply.
- Use a vivid, memorable everyday analogy.
- Step-by-step intuitive breakdown.
- Highlight the "Why it matters" in the real world."""
        }
        return prompts.get(mode, prompts["notes"])
