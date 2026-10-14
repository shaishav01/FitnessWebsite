import re
from datetime import date, datetime, timedelta
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_serializer, field_validator

from .catalog import GOAL_LABELS, PLAN_NAMES
from .cities import CITY_TO_STATE

_PHONE_ALLOWED = re.compile(r"^\+?[0-9][0-9 \-]*$")


def _clean(v: str) -> str:
    return " ".join(v.split())  # trim + collapse whitespace


def _validate_person_name(v: str) -> str:
    v = _clean(v)
    if not all(ch.isalpha() or ch in " .'-" for ch in v):
        raise ValueError("Only letters, spaces and . ' - are allowed")
    return v


def _validate_phone(v: str) -> str:
    v = v.strip()
    digits = re.sub(r"\D", "", v)
    if not _PHONE_ALLOWED.match(v) or not 10 <= len(digits) <= 13:
        raise ValueError("Enter a valid phone number (10-13 digits)")
    return v


def _utc(dt: datetime | None) -> str | None:
    return dt.isoformat() + "Z" if dt else None


# ---------- Public ----------
class InquiryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    phone: str = Field(max_length=25)
    city: str = Field(min_length=2, max_length=60)
    message: str = Field(min_length=10, max_length=1000)
    website: str = Field(default="", max_length=200)  # honeypot, must stay empty

    @field_validator("name", "city")
    @classmethod
    def _names(cls, v: str) -> str:
        return _validate_person_name(v)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return _validate_phone(v)

    @field_validator("message")
    @classmethod
    def _message(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 10:
            raise ValueError("Message must be at least 10 characters")
        return v


class MembershipCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    phone: str = Field(max_length=25)
    city: str = Field(min_length=2, max_length=60)
    plan: str
    branch_id: int | None = None
    start_date: date
    goal: str
    notes: str = Field(default="", max_length=500)
    website: str = Field(default="", max_length=200)  # honeypot

    @field_validator("name", "city")
    @classmethod
    def _names(cls, v: str) -> str:
        return _validate_person_name(v)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return _validate_phone(v)

    @field_validator("plan")
    @classmethod
    def _plan(cls, v: str) -> str:
        if v not in PLAN_NAMES:
            raise ValueError("Choose a membership plan")
        return v

    @field_validator("goal")
    @classmethod
    def _goal(cls, v: str) -> str:
        if v not in GOAL_LABELS:
            raise ValueError("Choose a fitness goal")
        return v

    @field_validator("start_date")
    @classmethod
    def _start(cls, v: date) -> date:
        today = date.today()
        if v < today - timedelta(days=1) or v > today + timedelta(days=180):
            raise ValueError("Pick a start date within the next 6 months")
        return v

    @field_validator("notes")
    @classmethod
    def _notes(cls, v: str) -> str:
        return v.strip()


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=1000)

    @field_validator("content")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Message cannot be empty")
        return v


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=30)

    @field_validator("messages")
    @classmethod
    def _last_is_user(cls, v: list[ChatMessage]) -> list[ChatMessage]:
        if v[-1].role != "user":
            raise ValueError("The last message must come from the user")
        return v


class ChatReply(BaseModel):
    reply: str


class PublicBranch(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    city: str
    state: str
    address: str
    phone: str


class InquiryAck(BaseModel):
    message: str


# ---------- Auth ----------
class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class AdminMe(BaseModel):
    username: str


# ---------- Admin: branches ----------
class BranchBase(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    city: str
    address: str = Field(min_length=5, max_length=300)
    contact_name: str = Field(min_length=2, max_length=80)
    phone: str = Field(max_length=25)
    email: EmailStr

    @field_validator("name", "address")
    @classmethod
    def _text(cls, v: str) -> str:
        return _clean(v)

    @field_validator("contact_name")
    @classmethod
    def _contact(cls, v: str) -> str:
        return _validate_person_name(v)

    @field_validator("phone")
    @classmethod
    def _phone(cls, v: str) -> str:
        return _validate_phone(v)

    @field_validator("city")
    @classmethod
    def _city(cls, v: str) -> str:
        if v not in CITY_TO_STATE:
            raise ValueError("Select a city from the list")
        return v


class BranchCreate(BranchBase):
    pass


class BranchUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=100)
    city: str | None = None
    address: str | None = Field(default=None, min_length=5, max_length=300)
    contact_name: str | None = Field(default=None, min_length=2, max_length=80)
    phone: str | None = Field(default=None, max_length=25)
    email: EmailStr | None = None

    @field_validator("name", "address")
    @classmethod
    def _text(cls, v):
        return _clean(v) if v is not None else v

    @field_validator("contact_name")
    @classmethod
    def _contact(cls, v):
        return _validate_person_name(v) if v is not None else v

    @field_validator("phone")
    @classmethod
    def _phone(cls, v):
        return _validate_phone(v) if v is not None else v

    @field_validator("city")
    @classmethod
    def _city(cls, v):
        if v is not None and v not in CITY_TO_STATE:
            raise ValueError("Select a city from the list")
        return v


class BranchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    city: str
    state: str
    address: str
    contact_name: str
    phone: str
    email: str
    customer_count: int = 0
    created_at: datetime

    @field_serializer("created_at")
    def _ser(self, v):
        return _utc(v)


class CityOut(BaseModel):
    city: str
    state: str


# ---------- Admin: inquiries ----------
class InquiryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str
    phone: str
    city: str
    message: str
    status: str
    created_at: datetime
    handled_at: datetime | None
    handled_by: str | None

    @field_serializer("created_at", "handled_at")
    def _ser(self, v):
        return _utc(v)


class InquiryStatusUpdate(BaseModel):
    status: Literal["new", "handled"]


class InquiryCounts(BaseModel):
    all: int
    new: int
    handled: int


class InquiryPage(BaseModel):
    items: list[InquiryOut]
    total: int
    counts: InquiryCounts


# ---------- Admin: membership applications ----------
class MembershipOut(BaseModel):
    id: int
    name: str
    email: str
    phone: str
    city: str
    plan: str
    plan_name: str
    branch_name: str | None
    start_date: date
    goal: str
    goal_label: str
    notes: str | None
    status: str
    created_at: datetime
    updated_at: datetime | None
    updated_by: str | None

    @field_serializer("created_at", "updated_at")
    def _ser(self, v):
        return _utc(v)


class MembershipStatusUpdate(BaseModel):
    status: Literal["new", "contacted", "enrolled", "declined"]


class MembershipCounts(BaseModel):
    all: int
    new: int
    contacted: int
    enrolled: int
    declined: int


class MembershipPage(BaseModel):
    items: list[MembershipOut]
    total: int
    counts: MembershipCounts


# ---------- Admin: metrics ----------
class Totals(BaseModel):
    customers: int
    active_customers: int
    new_customers_this_month: int
    inquiries: int
    new_inquiries: int
    applications: int
    new_applications: int


class CustomerPoint(BaseModel):
    month: str  # YYYY-MM
    new: int
    total: int


class InquiryPoint(BaseModel):
    month: str
    handled: int
    new: int


class ApplicationPoint(BaseModel):
    month: str
    reviewed: int
    new: int


class MetricsOut(BaseModel):
    totals: Totals
    customers_by_month: list[CustomerPoint]
    inquiries_by_month: list[InquiryPoint]
    applications_by_month: list[ApplicationPoint]
