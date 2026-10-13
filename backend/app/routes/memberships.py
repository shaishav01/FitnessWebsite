from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from ..catalog import GOAL_LABELS, PLAN_NAMES
from ..database import get_db
from ..models import AdminUser, MembershipApplication, utcnow
from ..schemas import MembershipCounts, MembershipOut, MembershipPage, MembershipStatusUpdate
from ..security import get_current_admin

router = APIRouter(prefix="/api/admin/memberships", tags=["memberships"])


def _out(a: MembershipApplication) -> MembershipOut:
    return MembershipOut(
        id=a.id, name=a.name, email=a.email, phone=a.phone, city=a.city, plan=a.plan,
        plan_name=PLAN_NAMES.get(a.plan, a.plan), branch_name=a.branch.name if a.branch else None,
        start_date=a.start_date, goal=a.goal, goal_label=GOAL_LABELS.get(a.goal, a.goal), notes=a.notes,
        status=a.status, created_at=a.created_at, updated_at=a.updated_at, updated_by=a.updated_by,
    )


@router.get("", response_model=MembershipPage)
def list_applications(
    status_filter: str | None = Query(default=None, alias="status", pattern="^(new|contacted|enrolled|declined)$"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    query = select(MembershipApplication)
    if status_filter:
        query = query.where(MembershipApplication.status == status_filter)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    rows = db.scalars(
        query.options(joinedload(MembershipApplication.branch))
        .order_by(MembershipApplication.created_at.desc(), MembershipApplication.id.desc())
        .limit(limit).offset(offset)
    ).all()

    by_status = dict(db.execute(
        select(MembershipApplication.status, func.count()).group_by(MembershipApplication.status)).all())
    counts = MembershipCounts(
        all=sum(by_status.values()), new=by_status.get("new", 0), contacted=by_status.get("contacted", 0),
        enrolled=by_status.get("enrolled", 0), declined=by_status.get("declined", 0))
    return MembershipPage(items=[_out(r) for r in rows], total=total, counts=counts)


@router.patch("/{application_id}", response_model=MembershipOut)
def update_application_status(
    application_id: int,
    payload: MembershipStatusUpdate,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    app = db.get(MembershipApplication, application_id)
    if app is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Application not found")
    app.status = payload.status
    app.updated_at, app.updated_by = utcnow(), admin.username
    db.commit()
    return _out(app)
