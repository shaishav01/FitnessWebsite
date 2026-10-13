from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AdminUser
from ..ratelimit import RateLimiter
from ..schemas import AdminMe, LoginRequest, TokenResponse
from ..security import DUMMY_HASH, create_access_token, get_current_admin, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Lock a (ip, username) pair for 15 minutes after 5 failed logins.
_failed_logins = RateLimiter(limit=5, window_seconds=900)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    ip = request.client.host if request.client else "unknown"
    key = f"{ip}|{payload.username.lower()}"
    wait = _failed_logins.retry_after(key)
    if wait:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many failed attempts. Try again later.",
            headers={"Retry-After": str(wait)},
        )

    user = db.scalar(select(AdminUser).where(AdminUser.username == payload.username))
    ok = verify_password(payload.password, user.password_hash if user else DUMMY_HASH)
    if not (user and ok):
        _failed_logins.hit(key)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")

    _failed_logins.reset(key)
    token, expires_in = create_access_token(user.username)
    return TokenResponse(access_token=token, expires_in=expires_in)


@router.get("/me", response_model=AdminMe)
def me(admin: AdminUser = Depends(get_current_admin)):
    return AdminMe(username=admin.username)
