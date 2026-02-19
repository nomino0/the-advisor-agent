import logging
from groq import Groq
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.llm_provider import LLMProvider
from app.db.session import AsyncSessionLocal

logger = logging.getLogger("cloudwise.llm")

class LLMService:
    def __init__(self):
        """Initialize Groq client with API key from .env"""
        from app.config import settings
        self.client = Groq(api_key=settings.groq_api_key)
        self.model = "moonshotai/kimi-k2-instruct-0905"

    async def get_active_provider(self, provider_name: str = None, capability: str = "general") -> LLMProvider:
        from app.config import settings
        # Return Kimi provider config
        return LLMProvider(
            name="Groq-Kimi",
            provider_type="groq",
            base_url="https://api.groq.com/openai/v1",
            api_key=settings.groq_api_key,
            models=["moonshotai/kimi-k2-instruct-0905"],
            priority=1,
            is_active=True
        )

    async def generate_completion(self, prompt: str, system_prompt: str = "You are a helpful assistant.", provider_name: str = None, model: str = None) -> str:
        """Generate completion using Groq Kimi model."""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.6,
                max_completion_tokens=4096,
                top_p=1
            )
            return response.choices[0].message.content
        except Exception as e:
            logger.error(f"LLM Call Failed (Groq-Kimi): {str(e)}")
            raise

    async def _call_gemini_native(self, provider: LLMProvider, prompt: str, system_prompt: str, model: str) -> str:
        # Legacy Gemini support - kept for future use
        import httpx
        selected_model = model or "gemini-pro"
        url = f"{provider.base_url.rstrip('/')}/models/{selected_model}:generateContent?key={provider.api_key}"
        
        payload = {
            "contents": [{
                "parts": [{"text": f"{system_prompt}\n\nUser: {prompt}"}]
            }]
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, timeout=60.0)
                response.raise_for_status()
                data = response.json()
                return data["candidates"][0]["content"]["parts"][0]["text"]
            except Exception as e:
                logger.error(f"Gemini Call Failed: {str(e)}")
                raise

llm_service = LLMService()
