from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base

INQUIRY_NEW = "new"
INQUIRY_HANDLED = "handled"

APPLICATION_STATUSES = ("new", "contacted", "enrolled", "declined")


def utcnow() -> datetime:
    """Naive UTC timestamp (portable across SQLite and PostgreSQL)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AppMeta(Base):
    __tablename__ = "app_meta"

    key: Mapped[str] = mapped_column(String(50), primary_key=True)
    value: Mapped[str] = mapped_column(String(200))


class AdminUser(Base):
    __tablename__ = "admin_users"

    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True)
    password_hash: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class Branch(Base):
    __tablename__ = "branches"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    city: Mapped[str] = mapped_column(String(60), index=True)
    state: Mapped[str] = mapped_column(String(60))
    address: Mapped[str] = mapped_column(String(300))
    contact_name: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(25))
    email: Mapped[str] = mapped_column(String(120))
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    customers: Mapped[list["Customer"]] = relationship(back_populates="branch")


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    email: Mapped[str] = mapped_column(String(120), index=True)
    phone: Mapped[str] = mapped_column(String(25))
    plan: Mapped[str] = mapped_column(String(20))  # plan id from app.catalog
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), index=True)
    joined_at: Mapped[date] = mapped_column(Date, index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)

    branch: Mapped[Branch] = relationship(back_populates="customers")


class Inquiry(Base):
    __tablename__ = "inquiries"
    __table_args__ = (Index("ix_inquiries_status_created", "status", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(25))
    city: Mapped[str] = mapped_column(String(60))
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(10), default=INQUIRY_NEW)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    handled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    handled_by: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)


class RevenueRecord(Base):
    __tablename__ = "revenue_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    branch_id: Mapped[int] = mapped_column(ForeignKey("branches.id"), index=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"), nullable=True)
    amount_inr: Mapped[int] = mapped_column(Integer)  # whole rupees
    plan: Mapped[str] = mapped_column(String(20))
    paid_on: Mapped[date] = mapped_column(Date, index=True)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)


class MembershipApplication(Base):
    __tablename__ = "membership_applications"
    __table_args__ = (Index("ix_applications_status_created", "status", "created_at"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    email: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(25))
    city: Mapped[str] = mapped_column(String(60))
    plan: Mapped[str] = mapped_column(String(20))
    branch_id: Mapped[int | None] = mapped_column(ForeignKey("branches.id"), nullable=True, index=True)
    start_date: Mapped[date] = mapped_column(Date)
    goal: Mapped[str] = mapped_column(String(20))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(12), default="new")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_by: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)

    branch: Mapped[Branch | None] = relationship()
