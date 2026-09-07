import os
import json
from groq import Groq
from ..config import Config

class GroqService:
    _instance = None
    _client = None

    @classmethod
    def get_client(cls):
        if cls._client is None:
            api_key = Config.GROQ_API_KEY or os.getenv("GROQ_API_KEY")
            if not api_key:
                raise ValueError("GROQ_API_KEY is missing from environment or .env")
            cls._client = Groq(api_key=api_key)
        return cls._client

    @staticmethod
    def clean_text(text):
        """Remove all thinking/reasoning artifacts from LLM output for clean display."""
        if not text:
            return ""
        import re

        cleaned = text

        # 1. Strip XML-style thinking tags (greedy across multiline)
        cleaned = re.sub(r"(?is)<think(?:\s[^>]*)?>.*?</think>", "", cleaned)
        cleaned = re.sub(r"(?is)<reasoning>.*?</reasoning>", "", cleaned)
        cleaned = re.sub(r"(?is)<internal>.*?</internal>", "", cleaned)
        cleaned = re.sub(r"(?is)<scratchpad>.*?</scratchpad>", "", cleaned)

        # 2. Strip unclosed <think> tags (model forgot to close)
        cleaned = re.sub(r"(?is)<think(?:\s[^>]*)?>.*$", "", cleaned)

        # 3. Strip "Thought Process:" / "Thinking:" / similar prefixed blocks
        cleaned = re.sub(
            r"(?ims)^\s*(?:thought process|thinking|internal reasoning|let me think|"
            r"here'?s my (?:thought|reasoning|analysis)|my reasoning|planning|"
            r"step-by-step reasoning|chain of thought|working through this)"
            r"\s*:?\s*.*?(?=\n\n|\n#{1,3}\s|\n---|\Z)",
            "", cleaned
        )

        # 4. Strip leading meta-commentary like "Here is the response:" or "Sure! Here you go:"
        cleaned = re.sub(
            r"(?i)^\s*(?:here (?:is|are) (?:the|your|my)|sure[,!.]*\s*(?:here|i'?d|let me)|"
            r"of course[,!.]*\s*(?:here|i'?d)|absolutely[,!.]*\s*(?:here|let me)|"
            r"great (?:question|topic)[,!.]*\s*(?:here|let me))"
            r"[^\n]*?(?::\s*\n|\n)",
            "", cleaned, count=1
        )

        # 5. Clean double heading prefixes like "## ### " -> "### "
        cleaned = re.sub(r"^#+\s+(#+\s+)", r"\1", cleaned, flags=re.MULTILINE)

        # 6. Remove excessive blank lines (more than 2 consecutive)
        cleaned = re.sub(r"\n{4,}", "\n\n\n", cleaned)

        return cleaned.strip()

    @classmethod
    def chat_completion(cls, messages, model=None, temperature=0.7, json_mode=False, max_tokens=4096):
        client = cls.get_client()
        target_model = model or Config.TEXT_MODEL
        
        kwargs = {
            "model": target_model,
            "messages": messages,
            "temperature": temperature,
            "max_completion_tokens": max_tokens
        }
        
        if json_mode:
            kwargs["response_format"] = {"type": "json_object"}
            
        try:
            response = client.chat.completions.create(**kwargs)
            raw = response.choices[0].message.content
            return cls.clean_text(raw) if not json_mode else raw
        except Exception as e:
            # Fallback for model deprecation or token format variations
            if "response_format" in kwargs and "not supported" in str(e).lower():
                del kwargs["response_format"]
                response = client.chat.completions.create(**kwargs)
                raw = response.choices[0].message.content
                return cls.clean_text(raw) if not json_mode else raw
            # If 120b hit any rate limit, fallback to 20b
            if target_model != "openai/gpt-oss-20b":
                kwargs["model"] = "openai/gpt-oss-20b"
                response = client.chat.completions.create(**kwargs)
                raw = response.choices[0].message.content
                return cls.clean_text(raw) if not json_mode else raw
            raise e

    @classmethod
    def vision_completion(cls, prompt, base64_image, mime_type="image/jpeg", model=None, max_tokens=4096):
        client = cls.get_client()
        target_model = model or Config.VISION_MODEL
        
        image_url = f"data:{mime_type};base64,{base64_image}"
        
        response = client.chat.completions.create(
            model=target_model,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {"url": image_url}
                        }
                    ]
                }
            ],
            max_completion_tokens=max_tokens
        )
        raw = response.choices[0].message.content
        return cls.clean_text(raw)
