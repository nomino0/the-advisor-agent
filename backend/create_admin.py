import asyncio
import uuid
import logging
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.security.password import hash_password
from sqlalchemy import select

logger = logging.getLogger("cloudwise")


async def main():
    async with AsyncSessionLocal() as db:
        email = 'admin@cloudwise.ai'
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        
        if user:
            logger.info('User %s already exists.', email)
            if user.role != 'admin':
                user.role = 'admin'
                await db.commit()
                logger.info('Updated %s to admin role.', email)
        else:
            new_admin = User(
                id=uuid.uuid4(),
                email=email,
                password_hash=hash_password('Admin123!'),
                full_name='System Administrator',
                role='admin',
                is_active=True
            )
            db.add(new_admin)
            await db.commit()
            logger.info('Created new admin user: %s', email)


if __name__ == '__main__':
    asyncio.run(main())
