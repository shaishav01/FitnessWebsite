from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from .config import get_secret_key, settings
from .database import get_db
from .models import AdminUser

ALGORITHM = "HS256"
_bearer = HTTPBearer(auto_error=False)
_SECRET = get_secret_key()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode()[:72], bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode()[:72], hashed.encode())
    except ValueError:
        return False


# Used to spend equal time when the username does not exist.
DUMMY_HASH = hash_password("not-a-real-password")


def create_access_token(username: str) -> tuple[str, int]:
    expires = timedelta(minutes=settings.access_token_minutes)
    payload = {"sub": username, "exp": datetime.now(timezone.utc) + expires}
    return jwt.encode(payload, _SECRET, algorithm=ALGORITHM), int(expires.total_seconds())


def get_current_admin(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db: Session = Depends(get_db),
) -> AdminUser:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if creds is None:
        raise unauthorized
    try:
        payload = jwt.decode(creds.credentials, _SECRET, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise unauthorized
    user = db.scalar(select(AdminUser).where(AdminUser.username == payload.get("sub")))
    if user is None:
        raise unauthorized
    return user
