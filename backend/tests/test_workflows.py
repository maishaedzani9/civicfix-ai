import io
import os
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from PIL import Image

# Tests use a disposable database and demo personas; never production credentials.
os.environ['ENVIRONMENT'] = 'demo'
os.environ['DEMO_MODE'] = 'true'
os.environ['DEMO_JWT_SECRET'] = 'test-only-secret-with-more-than-thirty-two-characters'
os.environ['DATABASE_URL'] = 'sqlite+aiosqlite://'
os.environ['EVIDENCE_DIRECTORY'] = '/tmp/civicfix-test-evidence'

from app.main import app
from app.config import Settings
from app.triage import local_draft, prepare_draft


@pytest.fixture
def client():
    with TestClient(app, raise_server_exceptions=True) as value:
        yield value


def auth(client, persona):
    token = client.post('/api/v1/demo/login', params={'persona': persona}).json()['access_token']
    return {'Authorization': 'Bearer ' + token}


def report(client, headers, **changes):
    category = next(c for c in client.get('/api/v1/categories').json() if c['slug'] == 'water_leak')
    payload = {'category_id': category['id'], 'title': 'Water leaking into the road',
               'description': 'A burst pipe is flooding the road near the campus entrance.', 'address_text': 'Campus entrance', 'urgency': 'high'}
    payload.update(changes)
    response = client.post('/api/v1/incidents', headers=headers, json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_complete_resident_staff_workflow_and_private_notes(client):
    resident, staff, manager = [auth(client, p) for p in ('resident', 'staff', 'manager')]
    incident = report(client, resident)
    assert incident['department_id']
    path = '/api/v1/incidents/' + incident['id']
    assert client.get(path, headers=staff).status_code == 200
    assert client.post(path + '/status-transitions', headers=resident, json={'to_status': 'acknowledged'}).status_code == 403
    assert client.post(path + '/status-transitions', headers=staff, json={'to_status': 'resolved'}).status_code == 409
    assert client.post(path + '/status-transitions', headers=staff, json={'to_status': 'acknowledged', 'internal_note': 'Staff confidential note', 'public_message': 'We received your report.'}).status_code == 200
    activity = client.get(path + '/activity', headers=resident).json()
    assert 'Staff confidential note' not in str(activity)
    assert 'We received your report.' in str(activity)
    assert 'Staff confidential note' in str(client.get(path + '/activity', headers=staff).json())
    assert client.post(path + '/assignments', headers=staff, json={'department_id': incident['department_id']}).status_code == 403
    assigned = client.post(path + '/assignments', headers=manager, json={'department_id': incident['department_id']})
    assert assigned.status_code == 200, assigned.text
    assert assigned.json()['status'] == 'assigned'
    for target in ('in_progress', 'resolved', 'closed'):
        response = client.post(path + '/status-transitions', headers=staff, json={'to_status': target})
        assert response.status_code == 200, response.text
    assert client.get('/api/v1/analytics/summary', headers=manager).json()['by_status']['closed'] >= 1
    assert client.get('/api/v1/exports/incidents.csv', headers=resident).status_code == 403
    assert incident['reference_number'] in client.get('/api/v1/exports/incidents.csv', headers=manager).text


def test_authorization_validation_and_pagination(client):
    resident, staff = auth(client, 'resident'), auth(client, 'staff')
    assert client.get('/api/v1/incidents').status_code == 401
    other = next(c for c in client.get('/api/v1/categories').json() if c['slug'] == 'pothole')
    incident = report(client, resident, category_id=other['id'])
    assert client.get('/api/v1/incidents/' + incident['id'], headers=staff).status_code == 404
    assert client.post('/api/v1/incidents', headers=resident, json={'category_id': str(uuid4()), 'title': 'Unknown category', 'description': 'A sufficiently long description.', 'address_text': 'Somewhere'}).status_code == 422
    assert client.post('/api/v1/incidents', headers=resident, json={'category_id': other['id'], 'title': '        ', 'description': 'A sufficiently long description.', 'address_text': 'Somewhere'}).status_code == 422
    assert client.get('/api/v1/incidents?cursor=!', headers=resident).status_code == 400
    report(client, resident)
    first = client.get('/api/v1/incidents?limit=1', headers=resident).json()
    assert first['next_cursor']
    second = client.get('/api/v1/incidents', params={'limit': 1, 'cursor': first['next_cursor']}, headers=resident).json()
    assert first['items'][0]['id'] != second['items'][0]['id']


def test_photo_validation_and_access(client):
    resident, staff = auth(client, 'resident'), auth(client, 'staff')
    incident = report(client, resident)
    path = '/api/v1/incidents/' + incident['id'] + '/evidence'
    assert client.post(path, headers=resident, files={'file': ('fake.jpg', b'not an image', 'image/jpeg')}).status_code == 422
    image = io.BytesIO()
    Image.new('RGB', (20, 20), 'red').save(image, 'PNG')
    response = client.post(path, headers=resident, files={'file': ('photo.png', image.getvalue(), 'image/png')})
    assert response.status_code == 201, response.text
    loaded = client.get(path + '/' + response.json()['id'], headers=resident)
    assert loaded.status_code == 200
    assert loaded.headers['content-type'] == 'image/jpeg'
    assert client.get(path + '/' + str(uuid4()), headers=resident).status_code == 404


def test_corrections_reject_stale_version(client):
    resident, staff = auth(client, 'resident'), auth(client, 'staff')
    incident = report(client, resident)
    path = '/api/v1/incidents/' + incident['id']
    payload = {'category_id': incident['category_id'], 'urgency': 'low', 'reason': 'Reassessed by staff', 'version': incident['version']}
    assert client.patch(path, headers=resident, json=payload).status_code == 403
    assert client.patch(path, headers=staff, json=payload).status_code == 200
    assert client.patch(path, headers=staff, json=payload).status_code == 409


def test_danger_draft_requires_emergency_followup(client):
    response = client.post('/api/v1/triage/draft', headers=auth(client, 'resident'), json={'message': 'There is a live wire sparking near the entrance.'})
    assert response.status_code == 200
    draft = response.json()['draft']
    assert draft['immediate_danger'] is True
    assert draft['address_text'] is None
    assert 'emergency' in draft['follow_up']
    assert response.json()['provider'] == 'rules'


def test_demo_auth_is_disabled_without_explicit_demo_configuration(client):
    from app.config import get_settings
    app.dependency_overrides[get_settings] = lambda: Settings(environment='production', demo_mode=False)
    try:
        assert client.post('/api/v1/demo/login').status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_idempotent_submission(client):
    headers = {**auth(client, 'resident'), 'Idempotency-Key': str(uuid4())}
    first = report(client, headers)
    second = report(client, headers)
    assert first['id'] == second['id']
    category = next(c for c in client.get('/api/v1/categories').json() if c['slug'] == 'water_leak')
    assert client.post('/api/v1/incidents', headers=headers, json={'category_id': category['id'], 'title': 'Different incident', 'description': 'This is a different water leak report.', 'address_text': 'Elsewhere'}).status_code == 422


def test_signed_supabase_tokens_use_database_roles_not_user_metadata(client, monkeypatch):
    import jwt
    from datetime import datetime, UTC, timedelta
    from cryptography.hazmat.primitives.asymmetric import ec
    from types import SimpleNamespace
    from app.config import get_settings
    import app.auth as module
    private = ec.generate_private_key(ec.SECP256R1())
    monkeypatch.setattr(module, 'jwks_client', lambda url: SimpleNamespace(get_signing_key_from_jwt=lambda token: SimpleNamespace(key=private.public_key())))
    app.dependency_overrides[get_settings] = lambda: Settings(demo_mode=False, supabase_jwt_issuer='https://test.supabase.co/auth/v1', supabase_jwks_url='https://test.supabase.co/auth/v1/.well-known/jwks.json')
    try:
        user_id = str(uuid4())
        claims = {'sub': user_id, 'aud': 'authenticated', 'iss': 'https://test.supabase.co/auth/v1', 'exp': datetime.now(UTC) + timedelta(hours=1), 'user_metadata': {'display_name': 'Real Resident', 'role': 'admin'}}
        access = jwt.encode(claims, private, algorithm='ES256')
        headers = {'Authorization': 'Bearer ' + access}
        assert client.get('/api/v1/me', headers=headers).json()['role'] == 'resident'
        assert client.get('/api/v1/analytics/summary', headers=headers).status_code == 403
        incident = report(client, headers)
        # Other residents cannot read the new account's reports.
        from app.demo import DEMO_USERS
        from app.auth import demo_token
        demo_settings = Settings(demo_mode=True, environment='demo', demo_jwt_secret=os.environ['DEMO_JWT_SECRET'])
        app.dependency_overrides[get_settings] = lambda: demo_settings
        other = {'Authorization': 'Bearer ' + demo_token(DEMO_USERS['resident'], demo_settings)}
        assert client.get('/api/v1/incidents/' + incident['id'], headers=other).status_code == 404
        app.dependency_overrides[get_settings] = lambda: Settings(demo_mode=False, supabase_jwt_issuer='https://test.supabase.co/auth/v1', supabase_jwks_url='https://test.supabase.co/auth/v1/.well-known/jwks.json')
        claims['iss'] = 'wrong-issuer'
        bad = jwt.encode(claims, private, algorithm='ES256')
        assert client.get('/api/v1/me', headers={'Authorization': 'Bearer ' + bad}).status_code == 401
    finally:
        app.dependency_overrides.clear()


def test_triage_sessions_are_owned_and_require_confirmation(client):
    resident, staff = auth(client, 'resident'), auth(client, 'staff')
    session = client.post('/api/v1/triage/sessions', headers=resident).json()
    path = '/api/v1/triage/sessions/' + session['id']
    assert client.post(path + '/messages', headers=staff, json={'message': 'There is water leaking near the road.'}).status_code == 404
    assert client.post(path + '/confirm', headers=resident).status_code == 409
    assert client.post(path + '/messages', headers=resident, json={'message': 'There is water leaking near the road.'}).status_code == 200
    category = next(c for c in client.get('/api/v1/categories').json() if c['slug'] == 'water_leak')
    payload = {'category_id': category['id'], 'title': 'Water leaking into road', 'description': 'There is a burst pipe near the campus.', 'address_text': 'Campus', 'ai_triage_id': session['id']}
    assert client.post('/api/v1/incidents', headers=resident, json=payload).status_code == 422
    assert client.post(path + '/confirm', headers=resident).status_code == 200
    assert client.post('/api/v1/incidents', headers=resident, json=payload).status_code == 201


@pytest.mark.asyncio
async def test_ai_output_is_validated_and_failures_do_not_submit(monkeypatch):
    from types import SimpleNamespace
    import app.triage as module
    import json
    draft = local_draft('There is water leaking near the campus entrance.').model_dump(mode='json')
    class FakeClient:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def post(self, url, **kwargs):
            assert kwargs['json']['store'] is False
            return SimpleNamespace(raise_for_status=lambda: None, json=lambda: {'choices': [{'message': {'content': json.dumps(draft)}}]})
    monkeypatch.setattr(module.httpx, 'AsyncClient', FakeClient)
    settings = Settings(ai_api_key='test-key')
    result = await prepare_draft('There is water leaking near the campus entrance.', ['water_leak', 'other'], settings)
    assert result['provider'] == 'ai'
    draft['category'] = 'not_a_real_category'
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as caught:
        await prepare_draft('There is water leaking near the campus entrance.', ['water_leak', 'other'], settings)
    assert caught.value.status_code == 502


def test_admin_management_is_privileged_and_audited(client):
    admin, resident = auth(client, 'admin'), auth(client, 'resident')
    unique = uuid4().hex[:8]
    dept = {'name': 'Test Department ' + unique, 'slug': 'test-department-' + unique}
    assert client.post('/api/v1/admin/departments', headers=resident, json=dept).status_code == 403
    created = client.post('/api/v1/admin/departments', headers=admin, json=dept)
    assert created.status_code == 201
    assert client.post('/api/v1/admin/departments', headers=admin, json=dept).status_code == 409
    assert client.post('/api/v1/admin/categories', headers=admin, json={'name': 'Test Issue ' + unique, 'slug': 'test_issue_' + unique, 'department_id': created.json()['id']}).status_code == 201
    assert any(e['action'] == 'department.create' for e in client.get('/api/v1/audit', headers=admin).json())
    assert client.get('/api/v1/audit', headers=resident).status_code == 403
    from app.demo import DEMO_USERS
    assert client.patch('/api/v1/admin/profiles/' + str(DEMO_USERS['admin']), headers=admin, json={'role': 'resident'}).status_code == 409


def test_resident_can_request_review_after_resolution(client):
    resident, staff = auth(client, 'resident'), auth(client, 'staff')
    incident = report(client, resident)
    path = '/api/v1/incidents/' + incident['id']
    assert client.post(path + '/review-request', headers=resident, json={'body': 'The issue is still present.'}).status_code == 409
    manager = auth(client, 'manager')
    assert client.post(path + '/status-transitions', headers=staff, json={'to_status': 'acknowledged'}).status_code == 200
    assert client.post(path + '/assignments', headers=manager, json={'department_id': incident['department_id']}).status_code == 200
    for status in ('in_progress','resolved'):
        assert client.post(path + '/status-transitions', headers=staff, json={'to_status': status}).status_code == 200
    assert client.post(path + '/review-request', headers=resident, json={'body': 'The issue is still present.'}).status_code == 201
    assert 'Resident requested review' in str(client.get(path + '/activity', headers=resident).json())
