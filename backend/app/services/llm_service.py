import httpx
import logging
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.llm_provider import LLMProvider
from app.db.session import AsyncSessionLocal

logger = logging.getLogger("cloudwise.llm")

class LLMService:
    async def get_active_provider(self, provider_name: str = None) -> LLMProvider:
        async with AsyncSessionLocal() as db:
            if provider_name:
                result = await db.execute(select(LLMProvider).where(LLMProvider.name == provider_name))
            else:
                # Default to first active provider
                result = await db.execute(select(LLMProvider).where(LLMProvider.is_active == True).limit(1))
            
            provider = result.scalar_one_or_none()
            if not provider:
                raise ValueError(f"No active LLM provider found (requested: {provider_name})")
            return provider

    async def generate_completion(self, prompt: str, system_prompt: str = "You are a helpful assistant.", provider_name: str = None, model: str = None) -> str:
        provider = await self.get_active_provider(provider_name)
        
        # Determine adapter based on provider name (or just try OpenAI format primarily)
        # Most modern providers (Groq, OpenRouter, Together, etc.) support OpenAI format.
        # Gemini uses a different format, but recent updates added OpenAI compatibility too via specific endpoints.
        # For robustness, we'll check the name.
        
        url = provider.base_url.rstrip('/')
        if "googleapis" in url or "gemini" in provider.name.lower():
            if "openai" not in url:
                return await self._call_gemini_native(provider, prompt, system_prompt, model)
        
        # Default to OpenAI compatible
        return await self._call_openai_compatible(provider, prompt, system_prompt, model)

    async def _call_openai_compatible(self, provider: LLMProvider, prompt: str, system_prompt: str, model: str) -> str:
        url = f"{provider.base_url.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {provider.api_key}",
            "Content-Type": "application/json"
        }
        
        # Use first available model if not specified
        selected_model = model or (provider.models[0] if provider.models else "default-model")
        
        payload = {
            "model": selected_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.2
        }

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=payload, headers=headers, timeout=60.0)
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"]
            except Exception as e:
                logger.error(f"LLM Call Failed ({provider.name}): {str(e)}")
                if response:
                    logger.error(f"Response: {response.text}")
                raise

    async def _call_gemini_native(self, provider: LLMProvider, prompt: str, system_prompt: str, model: str) -> str:
        # Google Generative AI REST API
        # POST https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_API_KEY
        
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
