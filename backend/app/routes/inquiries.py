from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import INQUIRY_HANDLED, INQUIRY_NEW, AdminUser, Inquiry, utcnow
from ..schemas import InquiryCounts, InquiryOut, InquiryPage, InquiryStatusUpdate
from ..security import get_current_admin

router = APIRouter(prefix="/api/admin/inquiries", tags=["inquiries"])


@router.get("", response_model=InquiryPage)
def list_inquiries(
    status_filter: str | None = Query(default=None, alias="status", pattern="^(new|handled)$"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    _: AdminUser = Depends(get_current_admin),
):
    query = select(Inquiry)
    if status_filter:
        query = query.where(Inquiry.status == status_filter)
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = db.scalars(query.order_by(Inquiry.created_at.desc(), Inquiry.id.desc()).limit(limit).offset(offset)).all()

    new_count, handled_count = db.execute(
        select(
            func.coalesce(func.sum(case((Inquiry.status == INQUIRY_NEW, 1), else_=0)), 0),
            func.coalesce(func.sum(case((Inquiry.status == INQUIRY_HANDLED, 1), else_=0)), 0),
        )
    ).one()
    counts = InquiryCounts(all=new_count + handled_count, new=new_count, handled=handled_count)
    return InquiryPage(items=items, total=total, counts=counts)


@router.patch("/{inquiry_id}", response_model=InquiryOut)
def update_inquiry_status(
    inquiry_id: int,
    payload: InquiryStatusUpdate,
    db: Session = Depends(get_db),
    admin: AdminUser = Depends(get_current_admin),
):
    inquiry = db.get(Inquiry, inquiry_id)
    if inquiry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Inquiry not found")
    inquiry.status = payload.status
    if payload.status == INQUIRY_HANDLED:
        inquiry.handled_at, inquiry.handled_by = utcnow(), admin.username
    else:
        inquiry.handled_at = inquiry.handled_by = None
    db.commit()
    return inquiry
