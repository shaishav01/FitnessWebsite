from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..catalog import GOAL_LABELS, GOALS, PLAN_NAMES, PLANS, SERVICES
from ..database import get_db
from ..mailer import send_inquiry_email, send_membership_email
from ..models import Branch, Inquiry, MembershipApplication
from ..ratelimit import RateLimiter
from ..schemas import InquiryAck, InquiryCreate, MembershipCreate, PublicBranch

router = APIRouter(prefix="/api/public", tags=["public"])

# 5 submissions per 10 minutes per IP, per form
_inquiry_limiter = RateLimiter(limit=5, window_seconds=600)
_application_limiter = RateLimiter(limit=5, window_seconds=600)


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def _check_limit(limiter: RateLimiter, ip: str) -> None:
    wait = limiter.retry_after(ip)
    if wait:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many submissions. Please try again later.",
            headers={"Retry-After": str(wait)},
        )


@router.get("/catalog")
def catalog():
    return {"services": SERVICES, "plans": PLANS, "goals": GOALS}


@router.get("/branches", response_model=list[PublicBranch])
def public_branches(db: Session = Depends(get_db)):
    return db.scalars(select(Branch).order_by(Branch.city, Branch.name)).all()


@router.post("/inquiries", response_model=InquiryAck, status_code=status.HTTP_201_CREATED)
def create_inquiry(
    payload: InquiryCreate,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    ip = _client_ip(request)
    _check_limit(_inquiry_limiter, ip)
    ack = InquiryAck(message="Thanks! Our team will get back to you shortly.")
    if payload.website:  # honeypot tripped: pretend success, store nothing
        return ack
    _inquiry_limiter.hit(ip)

    data = payload.model_dump(exclude={"website"})
    db.add(Inquiry(**data))
    db.commit()
    background.add_task(send_inquiry_email, data)
    return ack


@router.post("/memberships", response_model=InquiryAck, status_code=status.HTTP_201_CREATED)
def apply_for_membership(
    payload: MembershipCreate,
    request: Request,
    background: BackgroundTasks,
    db: Session = Depends(get_db),
):
    ip = _client_ip(request)
    _check_limit(_application_limiter, ip)
    ack = InquiryAck(message="Application received! We'll contact you within one working day to complete your enrolment.")
    if payload.website:
        return ack

    branch = None
    if payload.branch_id is not None:
        branch = db.get(Branch, payload.branch_id)
        if branch is None:
            raise HTTPException(422, [
                {"loc": ["body", "branch_id"], "msg": "Choose a branch from the list", "type": "value_error"}])
    _application_limiter.hit(ip)

    data = payload.model_dump(exclude={"website"})
    data["notes"] = data["notes"] or None
    db.add(MembershipApplication(**data))
    db.commit()
    background.add_task(send_membership_email, {
        **data,
        "plan_name": PLAN_NAMES[data["plan"]],
        "goal_label": GOAL_LABELS[data["goal"]],
        "branch_name": branch.name if branch else None,
    })
    return ack
