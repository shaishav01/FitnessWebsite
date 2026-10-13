from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import INQUIRY_HANDLED, Customer, Inquiry, MembershipApplication
from ..schemas import ApplicationPoint, CustomerPoint, InquiryPoint, MetricsOut, Totals
from ..security import get_current_admin

router = APIRouter(prefix="/api/admin", tags=["metrics"], dependencies=[Depends(get_current_admin)])


def _month_expr(db: Session, column):
    """'YYYY-MM' bucket expression for the active database dialect."""
    if db.get_bind().dialect.name == "sqlite":
        return func.strftime("%Y-%m", column)
    return func.to_char(column, "YYYY-MM")


def _month_keys(n: int) -> list[str]:
    today = date.today()
    keys = []
    for i in range(n - 1, -1, -1):
        idx = today.year * 12 + (today.month - 1) - i
        keys.append(f"{idx // 12:04d}-{idx % 12 + 1:02d}")
    return keys


def _split_by_month(db: Session, model, date_col, done_expr) -> dict[str, tuple[int, int]]:
    """month -> (done_count, total_count)"""
    m = _month_expr(db, date_col)
    rows = db.execute(select(m, func.sum(case((done_expr, 1), else_=0)), func.count()).group_by(m)).all()
    return {k: (int(done or 0), int(total)) for k, done, total in rows}


@router.get("/metrics", response_model=MetricsOut)
def metrics(months: int = Query(default=12, ge=3, le=36), db: Session = Depends(get_db)):
    keys = _month_keys(months)
    current = keys[-1]

    # Customers
    cust_m = _month_expr(db, Customer.joined_at)
    joined = dict(db.execute(select(cust_m, func.count()).group_by(cust_m)).all())
    total_customers = db.scalar(select(func.count()).select_from(Customer)) or 0
    active_customers = db.scalar(select(func.count()).select_from(Customer).where(Customer.is_active)) or 0
    running = sum(n for m, n in joined.items() if m < keys[0])
    customer_series = []
    for k in keys:
        running += joined.get(k, 0)
        customer_series.append(CustomerPoint(month=k, new=joined.get(k, 0), total=running))

    # Contact messages (handled vs new) and membership applications (reviewed vs new)
    inq = _split_by_month(db, Inquiry, Inquiry.created_at, Inquiry.status == INQUIRY_HANDLED)
    apps = _split_by_month(db, MembershipApplication, MembershipApplication.created_at, MembershipApplication.status != "new")

    def point(src, k):
        done, total = src.get(k, (0, 0))
        return done, total - done

    inq_total = sum(t for _, t in inq.values())
    inq_done = sum(d for d, _ in inq.values())
    app_total = sum(t for _, t in apps.values())
    app_done = sum(d for d, _ in apps.values())

    return MetricsOut(
        totals=Totals(
            customers=total_customers, active_customers=active_customers,
            new_customers_this_month=joined.get(current, 0),
            inquiries=inq_total, new_inquiries=inq_total - inq_done,
            applications=app_total, new_applications=app_total - app_done,
        ),
        customers_by_month=customer_series,
        inquiries_by_month=[InquiryPoint(month=k, handled=point(inq, k)[0], new=point(inq, k)[1]) for k in keys],
        applications_by_month=[ApplicationPoint(month=k, reviewed=point(apps, k)[0], new=point(apps, k)[1]) for k in keys],
    )
