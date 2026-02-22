import asyncio
from sqlalchemy import text
import logging

logger = logging.getLogger("cloudwise")

from app.db.session import engine

async def create_table():
    try:
        async with engine.begin() as conn:
            # Create table if not exists with all columns
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS llm_providers (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    name VARCHAR NOT NULL UNIQUE,
                    provider_type VARCHAR DEFAULT 'openai',
                    base_url VARCHAR NOT NULL,
                    api_key VARCHAR NOT NULL,
                    models JSONB DEFAULT '[]'::jsonb,
                    priority INTEGER DEFAULT 10,
                    is_active BOOLEAN DEFAULT TRUE
                );
            """))
            
            # Add missing columns if table already existed (idempotency for existing table)
            # We catch errors if column exists, or check first. 
            # Simplified approach: Try ADD COLUMN, ignore if exists error (Postgres specific: IF NOT EXISTS is only for table)
            
            # Check if columns exist
            result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='llm_providers';
            """))
            existing_columns = [row[0] for row in result.fetchall()]
            
            if 'provider_type' not in existing_columns:
                logger.info("Adding provider_type column...")
                await conn.execute(text("ALTER TABLE llm_providers ADD COLUMN provider_type VARCHAR DEFAULT 'openai';"))

            if 'priority' not in existing_columns:
                logger.info("Adding priority column...")
                await conn.execute(text("ALTER TABLE llm_providers ADD COLUMN priority INTEGER DEFAULT 10;"))

            if 'agent_capability' not in existing_columns:
                logger.info("Adding agent_capability column...")
                await asyncio.sleep(0.1) # Let previous ops finish
                await conn.execute(text("ALTER TABLE llm_providers ADD COLUMN agent_capability JSONB DEFAULT '[\"general\"]'::jsonb;"))

        logger.info("Table llm_providers is up to date.")
        
        # Seed Groq if table empty
        async with engine.begin() as conn:
            result = await conn.execute(text("SELECT count(*) FROM llm_providers"))
            count = result.scalar()
            
            # Always update Groq provider to latest model and API key from .env
            logger.info("Updating Groq-Kimi provider from .env...")
            from app.config import settings
            key = settings.groq_api_key
            if key:
                # First delete old provider if exists
                await conn.execute(text("DELETE FROM llm_providers WHERE name = 'Groq' OR name = 'Groq-Kimi';"))
                # Seed with Kimi model (using parameterized query to prevent SQL injection)
                await conn.execute(text("""
                    INSERT INTO llm_providers (id, name, provider_type, base_url, api_key, models, priority, is_active, agent_capability)
                    VALUES (
                        gen_random_uuid(), 
                        'Groq-Kimi', 
                        'groq', 
                        'https://api.groq.com/openai/v1', 
                        :api_key, 
                        '["moonshotai/kimi-k2-instruct-0905"]'::jsonb, 
                        1, 
                        TRUE, 
                        '["general", "security", "planner"]'::jsonb
                    );
                """), {"api_key": key})
                logger.info("Updated Groq provider with moonshotai/kimi-k2-instruct-0905 model.")
            else:
                logger.info("No Groq key in settings.")

    except Exception as e:
        logger.error("Error creating/updating table: %s", e)

if __name__ == "__main__":
    asyncio.run(create_table())
