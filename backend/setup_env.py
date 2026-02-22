import asyncio
import sys
import os
import subprocess
import logging

logger = logging.getLogger("cloudwise")


def check_dependencies():
    logger.info("Checking critical dependencies...")
    try:
        import asyncpg  # noqa: F401
        import uvicorn  # noqa: F401
        import sqlalchemy  # noqa: F401
    except ImportError as e:
        logger.warning("Missing dependency: %s", getattr(e, 'name', str(e)))
        logger.info("Installing dependencies from requirements.txt...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
            logger.info("Dependencies installed successfully.")
        except subprocess.CalledProcessError:
            logger.error("Failed to install dependencies. Please run 'pip install -r requirements.txt' manually.")
            sys.exit(1)


check_dependencies()

from sqlalchemy import text, select
from app.db.session import engine, Base, AsyncSessionLocal
# Import specific models to populate metadata and keep namespace explicit
from app.models import User, RagDocument, KnowledgeBaseSource  # noqa: F401
from app.security.password import hash_password
import uuid

# Ensure we can import 'app' if running from backend/
# sys.path.append(os.getcwd()) is already done at top of script

async def check_db_connection():
    logger.info("1. Checking Database Connection...")
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        logger.info("   [OK] Database Connected!")
        return True
    except Exception as e:
        logger.error("   [ERROR] Could not connect to database: %s", e)
        logger.error("   -> Check your .env file and ensure PostgreSQL is running.")
        return False

async def init_db():
    logger.info("\n2. Initializing Database Tables...")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("   [OK] Tables created (if missing).")
    except Exception as e:
        logger.error("   [ERROR] Failed to create tables: %s", e)

async def patch_schema():
    logger.info("\n3. Verifying Schema & Applying Patches...")
    async with engine.begin() as conn:
        # 1. RAG Columns
        logger.info("   - Checking 'rag_documents' schema...")
        try:
            await conn.execute(text("ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''"))
            await conn.execute(text("ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS target_agent VARCHAR(50) DEFAULT 'general'"))
            await conn.execute(text("ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS processed_content TEXT"))
            logger.info("     -> RAG columns verified.")
        except Exception as e:
            logger.warning("     -> (Note) RAG patch skipped/failed: %s", e)

        # 2. Knowledge Base Status
        logger.info("   - Checking 'knowledge_base_sources' schema...")
        try:
            await conn.execute(text("ALTER TABLE knowledge_base_sources ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'"))
            logger.info("     -> Knowledge Base status verified.")
        except Exception as e:
            logger.warning("     -> (Note) KB patch skipped: %s", e)

        # 3. User email_verified column
        logger.info("   - Checking 'users' schema for 'email_verified' column...")
        try:
            await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE"))
            logger.info("     -> 'email_verified' column verified.")
        except Exception as e:
            logger.warning("     -> (Note) User email_verified patch skipped/failed: %s", e)

async def seed_admin():
    logger.info("\n4. Seeding Admin User...")
    async with AsyncSessionLocal() as db:
        email = "admin@cloudwise.ai"
        try:
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            if user:
                logger.info("   [OK] Admin user %s already exists.", email)
            else:
                logger.info("   -> Creating admin user %s...", email)
                new_admin = User(
                    id=uuid.uuid4(),
                    email=email,
                    password_hash=hash_password("Admin123!"),
                    full_name="System Administrator",
                    role="admin",
                    is_active=True
                )
                db.add(new_admin)
                await db.commit()
                logger.info("   [OK] Admin user created successfully.")
        except Exception as e:
            logger.error("   [ERROR] Failed to seed admin: %s", e)

async def main():
    logger.info("===========================================")
    logger.info("   CloudWise AI - Environment Setup Tool   ")
    logger.info("===========================================")
    
    if not await check_db_connection():
        return

    await init_db()
    await patch_schema()
    await seed_admin()

    logger.info("\n===========================================")
    logger.info("   Setup Complete! Ready to launch.        ")
    logger.info("===========================================")
    logger.info("Run Backend: uvicorn app.main:app --reload")
    logger.info("Run Frontend: npm run dev")

if __name__ == "__main__":
    asyncio.run(main())
