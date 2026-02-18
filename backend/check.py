import asyncio
from app.db.session import AsyncSessionLocal
from app.models.user import User
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.role == 'admin'))
        users = result.scalars().all()
        print(f'ADMIN_USERS: {len(users)}')
        for u in users:
            print(f'- {u.email} (ID: {u.id})')

if __name__ == '__main__':
    asyncio.run(main())
