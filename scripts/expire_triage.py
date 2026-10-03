"""Delete expired triage conversations. Run daily with the backend environment loaded."""
import asyncio
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'backend'))
from sqlalchemy import text
from app.db import SessionFactory
async def main():
    async with SessionFactory() as session:
        await session.execute(text('delete from triage_messages where session_id in (select id from triage_sessions where expires_at < current_timestamp)'))
        await session.execute(text('delete from triage_sessions where expires_at < current_timestamp and not exists (select 1 from incidents where incidents.ai_triage_id = triage_sessions.id)'))
        await session.commit()
if __name__ == '__main__': asyncio.run(main())
