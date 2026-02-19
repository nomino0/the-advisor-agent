import asyncio
import sys
import os
import subprocess

def check_dependencies():
    print("Checking critical dependencies...")
    try:
        import asyncpg
        import uvicorn
        import sqlalchemy
    except ImportError as e:
        print(f"Missing dependency: {e.name}")
        print("Installing dependencies from requirements.txt...")
        try:
            subprocess.check_call([sys.executable, "-m", "pip", "install", "-r", "requirements.txt"])
            print("Dependencies installed successfully.")
        except subprocess.CalledProcessError:
            print("Failed to install dependencies. Please run 'pip install -r requirements.txt' manually.")
            sys.exit(1)

check_dependencies()

from sqlalchemy import text, select
from app.db.session import engine, Base, AsyncSessionLocal
# Import all models to ensure Base.metadata is populated
from app.models import * 
from app.security.password import hash_password
import uuid

# Ensure we can import 'app' if running from backend/
# sys.path.append(os.getcwd()) is already done at top of script

async def check_db_connection():
    print("1. Checking Database Connection...")
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        print("   [OK] Database Connected!")
        return True
    except Exception as e:
        print(f"   [ERROR] Could not connect to database: {e}")
        print("   -> Check your .env file and ensure PostgreSQL is running.")
        return False

async def init_db():
    print("\n2. Initializing Database Tables...")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("   [OK] Tables created (if missing).")
    except Exception as e:
        print(f"   [ERROR] Failed to create tables: {e}")

async def patch_schema():
    print("\n3. Verifying Schema & Applying Patches...")
    async with engine.begin() as conn:
        # 1. RAG Columns
        print("   - Checking 'rag_documents' schema...")
        try:
            await conn.execute(text("ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''"))
            await conn.execute(text("ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS target_agent VARCHAR(50) DEFAULT 'general'"))
            await conn.execute(text("ALTER TABLE rag_documents ADD COLUMN IF NOT EXISTS processed_content TEXT"))
            print("     -> RAG columns verified.")
        except Exception as e:
            print(f"     -> (Note) RAG patch skipped/failed: {e}")

        # 2. Knowledge Base Status
        print("   - Checking 'knowledge_base_sources' schema...")
        try:
            await conn.execute(text("ALTER TABLE knowledge_base_sources ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending'"))
            print("     -> Knowledge Base status verified.")
        except Exception as e:
            print(f"     -> (Note) KB patch skipped: {e}")

async def seed_admin():
    print("\n4. Seeding Admin User...")
    async with AsyncSessionLocal() as db:
        email = "admin@cloudwise.ai"
        try:
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            if user:
                print(f"   [OK] Admin user {email} already exists.")
            else:
                print(f"   -> Creating admin user {email}...")
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
                print("   [OK] Admin user created successfully.")
        except Exception as e:
            print(f"   [ERROR] Failed to seed admin: {e}")

async def main():
    print("===========================================")
    print("   CloudWise AI - Environment Setup Tool   ")
    print("===========================================")
    
    if not await check_db_connection():
        return

    await init_db()
    await patch_schema()
    await seed_admin()
    
    print("\n===========================================")
    print("   Setup Complete! Ready to launch.        ")
    print("===========================================")
    print("Run Backend: uvicorn app.main:app --reload")
    print("Run Frontend: npm run dev")

if __name__ == "__main__":
    asyncio.run(main())
