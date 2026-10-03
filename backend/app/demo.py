"""Explicit local fixtures isolated from Supabase/production."""
from uuid import uuid5, NAMESPACE_URL
from app.models import Base, Category, Department, DepartmentCategory, Profile

DEMO_USERS = {name: uuid5(NAMESPACE_URL, 'civicfix-demo-' + name) for name in ('resident', 'staff', 'manager', 'admin')}
CATEGORIES = [('pothole', 'Pothole or road damage', 'Roads and Stormwater'),
              ('water_leak', 'Water leak', 'Water and Sanitation'),
              ('electricity_fault', 'Electricity fault', 'Electricity'),
              ('broken_streetlight', 'Broken streetlight', 'Electricity'),
              ('illegal_dumping', 'Illegal dumping', 'Waste Management'), ('other', 'Other infrastructure issue', None)]

async def initialize(engine, factory):
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
        columns = (await connection.exec_driver_sql("pragma table_info(incidents)")).all()
        if "ai_triage_id" not in {column[1] for column in columns}:
            await connection.exec_driver_sql("alter table incidents add column ai_triage_id char(32) references triage_sessions(id)")
    async with factory() as session:
        for slug, name, department_name in CATEGORIES:
            category_id = uuid5(NAMESPACE_URL, 'civicfix-category-' + slug)
            if not await session.get(Category, category_id):
                session.add(Category(id=category_id, name=name, slug=slug))
                await session.flush()
            if department_name:
                department_id = uuid5(NAMESPACE_URL, 'civicfix-department-' + department_name)
                if not await session.get(Department, department_id):
                    session.add(Department(id=department_id, name=department_name, slug=department_name.lower().replace(' ', '-')))
                    await session.flush()
                if not await session.get(DepartmentCategory, (department_id, category_id)):
                    session.add(DepartmentCategory(department_id=department_id, category_id=category_id))
        for role, user_id in DEMO_USERS.items():
            if not await session.get(Profile, user_id):
                session.add(Profile(id=user_id, display_name=f'Demo {role.capitalize()}', role=role,
                                    department_id=uuid5(NAMESPACE_URL, 'civicfix-department-Water and Sanitation') if role in ('staff', 'manager') else None))
        await session.commit()
