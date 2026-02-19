import httpx
from bs4 import BeautifulSoup
import logging
from app.services.llm_service import LLMService

logger = logging.getLogger("cloudwise.crawler")

class CrawlerService:
    def __init__(self):
        self.llm_service = LLMService()

    async def crawl_and_summarize(self, url: str) -> str:
        """
        Fetches the content from the URL, cleans it, and uses the LLM to generate a summary.
        """
        try:
            # 1. Fetch the webpage
            async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
                response = await client.get(url)
                response.raise_for_status()
                html_content = response.text

            # 2. Parse HTML and extract text
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style", "nav", "footer", "header"]):
                script.decompose()

            text = soup.get_text()

            # Break into lines and remove leading/trailing space on each
            lines = (line.strip() for line in text.splitlines())
            # Break multi-headlines into a line each
            chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
            # Drop blank lines
            clean_text = '\n'.join(chunk for chunk in chunks if chunk)

            # Truncate if too long (simple approach for now, could be improved with chunking)
            # LLM context window limits apply. Let's take first 15000 characters for now.
            truncated_text = clean_text[:15000]

            if not truncated_text:
                logger.warning(f"No text content found at URL: {url}")
                return "No content could be extracted from the URL."

            # 3. Summarize with LLM
            prompt = f"""
            You are a technical documentation assistant.
            The following text is extracted from a webpage ({url}).
            
            Please provide a comprehensive summary that captures the key technical details, 
            concepts, and guidelines useful for an AI agent acting as a cloud architect or security expert.
            Focus on facts, rules, configuration options, and architectural patterns.
            
            Format the output as a dense "Knowledge Context" string.
            
            Content:
            {truncated_text}
            """

            summary = await self.llm_service.generate_completion(
                prompt=prompt,
                system_prompt="You are an expert technical writer and summarizer."
            )
            
            return summary

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP error fetching URL {url}: {e}")
            return f"Error fetching content: HTTP {e.response.status_code}"
        except Exception as e:
            logger.error(f"Error processing URL {url}: {e}")
            return f"Error processing content: {str(e)}"
