"""Real PostgreSQL schema/trigger checks, run by CI with a disposable service database."""
import os
from pathlib import Path
from uuid import uuid4
import pytest

@pytest.mark.skipif(not os.getenv('TEST_DATABASE_URL'), reason='Requires disposable PostgreSQL service')
def test_supabase_schema_and_profile_provisioning():
    import psycopg
    root = Path(__file__).resolve().parents[2]
    with psycopg.connect(os.environ['TEST_DATABASE_URL'], autocommit=True) as connection:
        connection.execute('create schema if not exists auth; create table if not exists auth.users (id uuid primary key, raw_user_meta_data jsonb); create or replace function auth.uid() returns uuid language sql as $$ select null::uuid $$;')
        for name in ('schema.sql', 'seed.sql', 'migration_004_workflows.sql'):
            connection.execute((root / 'database' / name).read_text())
        user_id = uuid4()
        connection.execute("insert into auth.users values (%s, '{\"display_name\":\"CI Resident\",\"role\":\"admin\"}')", (user_id,))
        assert connection.execute('select display_name, role::text from profiles where id=%s', (user_id,)).fetchone() == ('CI Resident', 'resident')
        short_id = uuid4()
        connection.execute("insert into auth.users values (%s, '{\"display_name\":\"X\"}')", (short_id,))
        assert connection.execute('select display_name from profiles where id=%s', (short_id,)).fetchone()[0] == 'Resident'
        assert connection.execute('select count(*) from categories').fetchone()[0] == 6
        assert connection.execute("select count(*) from pg_policies where policyname='incidents_resident_insert'").fetchone()[0] == 0
        connection.execute((root / 'database' / 'migration_004_workflows.sql').read_text())

    # Exercise the same ORM repository against real PostgreSQL, including cursor comparison and audit writes.
    import asyncio
    from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
    from app.auth import Actor, Role
    from app.repository import IncidentRepository
    from app.schemas import IncidentCreate, StatusTransitionCreate
    from app.domain.incidents import IncidentStatus
    async def exercise():
        engine = create_async_engine(os.environ['TEST_DATABASE_URL'].replace('postgresql://', 'postgresql+asyncpg://', 1))
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as session:
            from sqlalchemy import text
            category_id = (await session.execute(text("select id from categories where slug='water_leak'"))).scalar_one()
            actor = Actor(user_id, Role.RESIDENT)
            payload = IncidentCreate(category_id=category_id, title='Postgres water leak test', description='A burst pipe is flooding the campus entrance.', address_text='Campus entrance')
            repository = IncidentRepository(session)
            first = await repository.create(actor, payload, 'postgres-test-key')
            assert first.department_id
            assert (await repository.create(actor, payload, 'postgres-test-key')).id == first.id
            second = await repository.create(actor, payload)
            items, cursor = await repository.list_authorized(actor, limit=1, cursor=None)
            assert len(items) == 1 and cursor
            following, _ = await repository.list_authorized(actor, limit=1, cursor=cursor)
            assert following[0].id != items[0].id
            staff_actor = Actor(user_id, Role.ADMIN)
            await repository.transition(staff_actor, first.id, StatusTransitionCreate(to_status=IncidentStatus.ACKNOWLEDGED, public_message='Received', internal_note='Private'))
            assert (await session.execute(text("select count(*) from audit_logs"))).scalar_one() >= 3
        await engine.dispose()
    asyncio.run(exercise())
