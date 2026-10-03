"""Run an isolated local demo: python scripts/run_demo.py (after dependency installs)."""
import os
from pathlib import Path
import secrets
import signal
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
backend_env = dict(os.environ, ENVIRONMENT='demo', DEMO_MODE='true',
                   DEMO_JWT_SECRET=secrets.token_urlsafe(48),
                   DATABASE_URL='sqlite+aiosqlite:///' + str(ROOT / 'civicfix-demo.db'),
                   CORS_ORIGINS='http://localhost:3000,http://127.0.0.1:3000', AI_API_KEY='', SUPABASE_URL='', SUPABASE_SERVICE_KEY='')
frontend_env = dict(os.environ, NEXT_PUBLIC_DEMO_MODE='true', NEXT_PUBLIC_API_URL='http://127.0.0.1:8000/api/v1')
processes = []
try:
    processes.append(subprocess.Popen([sys.executable, '-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '8000'], cwd=ROOT / 'backend', env=backend_env))
    processes.append(subprocess.Popen(['npm.cmd' if os.name == 'nt' else 'npm', 'run', 'dev', '--', '--hostname', '127.0.0.1'], cwd=ROOT / 'frontend', env=frontend_env))
    print('Open http://localhost:3000/login and choose a demo persona. Press Ctrl+C to stop.', flush=True)
    while all(p.poll() is None for p in processes):
        try:
            processes[0].wait(timeout=1)
        except subprocess.TimeoutExpired:
            pass
except KeyboardInterrupt:
    pass
finally:
    for process in processes:
        if process.poll() is None:
            process.terminate()
    for process in processes:
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
