from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import Settings, get_settings


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


bearer = HTTPBearer(auto_error=False)


def get_actor(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    settings: Settings = Depends(get_settings),
) -> Actor:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token.")
    if not settings.authentication_configured:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Authentication is not configured.")
    try:
        signing_key = jwt.PyJWKClient(settings.supabase_jwks_url).get_signing_key_from_jwt(credentials.credentials)
        claims = jwt.decode(
            credentials.credentials,
            signing_key.key,
            algorithms=["RS256", "ES256"],
            audience=settings.supabase_jwt_audience,
            issuer=settings.supabase_jwt_issuer,
        )
        app_metadata = claims.get("app_metadata") or {}
        role = Role(app_metadata.get("role", "resident"))
        department = app_metadata.get("department_id")
        return Actor(UUID(claims["sub"]), role, UUID(department) if department else None)
    except (KeyError, ValueError, jwt.PyJWTError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token.") from exc
