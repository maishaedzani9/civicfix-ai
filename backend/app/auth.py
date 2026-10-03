from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum
from functools import lru_cache
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings, get_settings
from app.db import get_session
from app.models import Profile


class Role(StrEnum):
    RESIDENT = "resident"
    STAFF = "staff"
    MANAGER = "manager"
    ADMIN = "admin"


@dataclass(frozen=True)
class Actor:
    user_id: UUID
    role: Role
    department_id: UUID | None = None
    display_name: str = "Resident"


bearer = HTTPBearer(auto_error=False)


@lru_cache
def jwks_client(url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(url)


def demo_token(user_id: UUID, settings: Settings) -> str:
    return jwt.encode({"sub": str(user_id), "aud": "civicfix-demo", "iss": "civicfix-local",
                       "exp": datetime.now(UTC) + timedelta(hours=2)}, settings.demo_jwt_secret, algorithm="HS256")


async def get_actor(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    settings: Settings = Depends(get_settings),
    session: AsyncSession = Depends(get_session),
) -> Actor:
    if credentials is None:
        raise HTTPException(401, "Sign in to continue.")
    try:
        if settings.demo_mode and settings.environment == "demo" and settings.demo_jwt_secret:
            claims = jwt.decode(credentials.credentials, settings.demo_jwt_secret, algorithms=["HS256"],
                                audience="civicfix-demo", issuer="civicfix-local")
        else:
            if not settings.authentication_configured:
                raise HTTPException(503, "Authentication is not configured.")
            key = jwks_client(settings.supabase_jwks_url).get_signing_key_from_jwt(credentials.credentials)
            claims = jwt.decode(credentials.credentials, key.key, algorithms=["RS256", "ES256"],
                                audience=settings.supabase_jwt_audience, issuer=settings.supabase_jwt_issuer)
        user_id = UUID(claims["sub"])
        profile = await session.get(Profile, user_id)
        if profile is None:
            # Roles never come from editable user metadata. New users always start as residents.
            name = str((claims.get("user_metadata") or {}).get("display_name") or "Resident").strip()[:120]
            profile = Profile(id=user_id, display_name=name if len(name) >= 2 else "Resident", role="resident")
            session.add(profile)
            await session.commit()
        return Actor(user_id, Role(profile.role), profile.department_id, profile.display_name)
    except (KeyError, ValueError, jwt.PyJWTError) as exc:
        raise HTTPException(401, "Invalid or expired access token.") from exc
