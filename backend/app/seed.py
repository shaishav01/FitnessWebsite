"""Admin bootstrap and realistic sample data (idempotent)."""
import logging
import random
import secrets
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from .catalog import GOALS
from .cities import CITY_TO_STATE
from .config import settings
from .models import (
    INQUIRY_HANDLED,
    INQUIRY_NEW,
    AdminUser,
    AppMeta,
    Branch,
    Customer,
    Inquiry,
    MembershipApplication,
    utcnow,
)
from .security import hash_password

log = logging.getLogger("kinetra.seed")

FIRST = ["Aarav", "Vihaan", "Aditya", "Arjun", "Reyansh", "Ishaan", "Kabir", "Rohan", "Karan", "Dev",
         "Ananya", "Diya", "Isha", "Kavya", "Meera", "Naina", "Priya", "Riya", "Saanvi", "Tara",
         "Neha", "Pooja", "Sneha", "Tanvi", "Zoya", "Imran", "Farhan", "Simran", "Harleen", "Gurpreet"]
LAST = ["Sharma", "Patel", "Iyer", "Reddy", "Nair", "Mehta", "Gupta", "Khan", "Singh", "Joshi",
        "Kulkarni", "Desai", "Bose", "Menon", "Kapoor", "Verma", "Shah", "Rao", "Chopra", "Banerjee"]

# (name, city, street, contact, weight)
SAMPLE_BRANCHES = [
    ("Kinetra Bandra", "Mumbai", "14 Hill Road, Bandra West", "Rahul Deshmukh", 0.26),
    ("Kinetra Connaught", "Delhi", "22 Barakhamba Road, Connaught Place", "Sanjana Malhotra", 0.22),
    ("Kinetra Indiranagar", "Bengaluru", "100 Feet Road, Indiranagar", "Karthik Rao", 0.22),
    ("Kinetra Jubilee Hills", "Hyderabad", "Road No. 36, Jubilee Hills", "Fatima Sheikh", 0.12),
    ("Kinetra Koregaon Park", "Pune", "Lane 5, Koregaon Park", "Aniket Joshi", 0.10),
    ("Kinetra SG Highway", "Ahmedabad", "Sarkhej-Gandhinagar Highway, Thaltej", "Hetal Patel", 0.08),
]

MESSAGES = [
    "I'd like to know the membership options and whether I can book a trial session this week.",
    "Do you have personal trainers who specialise in weight loss? Looking for a 3-month plan.",
    "What are the steam bath timings, and is it included in the Surge plan?",
    "Interested in the diet plan add-on. Can a nutritionist review my blood report?",
    "Is there a student discount on the Spark plan? I'm a college student looking to start next month.",
    "Can you share the timings of the cardio arena on weekends? We are a group of four.",
    "I want to join the strength gym. Do you offer powerlifting coaching and a free orientation?",
    "Could you tell me what's on the healthy food court menu? I follow a high-protein vegetarian diet.",
    "Looking for a corporate membership for 15 employees. Who should I speak to?",
    "I'm recovering from a knee injury. Do your trainers offer rehab-friendly programmes?",
    "How do I freeze my membership for a month while I travel?",
    "Planning to relocate to your city. Can I transfer my membership between branches?",
]


def ensure_admin(db: Session) -> None:
    if db.scalar(select(AdminUser).where(AdminUser.username == settings.admin_username)):
        return
    password = settings.admin_password or secrets.token_urlsafe(12)
    db.add(AdminUser(username=settings.admin_username, password_hash=hash_password(password)))
    db.commit()
    if not settings.admin_password:
        bar = "=" * 60
        print(f"\n{bar}\n  Admin account created\n  username: {settings.admin_username}\n"
              f"  password: {password}\n  (shown once - set ADMIN_PASSWORD in backend/.env to choose your own)\n{bar}\n", flush=True)


def _month_start(d: date, back: int) -> date:
    idx = d.year * 12 + (d.month - 1) - back
    return date(idx // 12, idx % 12 + 1, 1)


def seed_sample_data(db: Session) -> None:
    if not db.get(AppMeta, "sample_seeded"):
        _seed_base(db)
    if not db.get(AppMeta, "sample_applications_seeded"):
        _seed_applications(db)


def _seed_applications(db: Session) -> None:
    rng = random.Random(7)
    today = date.today()
    branches = db.scalars(select(Branch).where(Branch.is_sample)).all()
    apps = []
    for back in range(11, -1, -1):
        for _ in range(int((3 + (11 - back) * 0.6) * rng.uniform(0.8, 1.25))):
            when = datetime.combine(_month_start(today, back), datetime.min.time()) + timedelta(
                days=rng.randint(0, 27), hours=rng.randint(7, 22), minutes=rng.randint(0, 59))
            if when > utcnow():
                when = utcnow() - timedelta(hours=rng.randint(1, 72))
            age_days = (utcnow() - when).days
            if age_days > 21:
                status = rng.choices(["enrolled", "declined", "contacted"], [0.7, 0.2, 0.1])[0]
            elif age_days > 5:
                status = rng.choices(["enrolled", "contacted", "new"], [0.4, 0.4, 0.2])[0]
            else:
                status = rng.choices(["new", "contacted"], [0.75, 0.25])[0]
            first, last = rng.choice(FIRST), rng.choice(LAST)
            branch = rng.choice(branches) if branches and rng.random() < 0.85 else None
            apps.append(MembershipApplication(
                name=f"{first} {last}", email=f"{first}.{last}{rng.randint(1, 99)}@example.com".lower(),
                phone=f"+91 90000 {rng.randint(10000, 99999)}", city=branch.city if branch else rng.choice(local_city_names()),
                plan=rng.choices(["spark", "surge", "apex"], [0.4, 0.4, 0.2])[0], branch_id=branch.id if branch else None,
                start_date=(when + timedelta(days=rng.randint(2, 20))).date(), goal=rng.choice(GOALS)["id"],
                notes=rng.choice([None, None, "Prefer evening batches.", "Have a mild knee injury.", "Corporate referral."]),
                status=status, created_at=when, is_sample=True,
                updated_at=when + timedelta(hours=rng.randint(2, 40)) if status != "new" else None,
                updated_by=settings.admin_username if status != "new" else None,
            ))
    db.add_all(apps)
    db.add(AppMeta(key="sample_applications_seeded", value=today.isoformat()))
    db.commit()


def local_city_names() -> list[str]:
    return [b[1] for b in SAMPLE_BRANCHES]


def _seed_base(db: Session) -> None:
    rng = random.Random(42)
    today = date.today()

    branches = []
    for name, city, street, contact, _w in SAMPLE_BRANCHES:
        b = Branch(
            name=name, city=city, state=CITY_TO_STATE[city], address=f"{street}, {city}",
            contact_name=contact, phone=f"+91 90000 {rng.randint(10000, 99999)}",
            email=f"{city.lower()}@kinetra.example", is_sample=True,
            created_at=datetime.combine(_month_start(today, 17), datetime.min.time()),
        )
        branches.append(b)
    db.add_all(branches)
    db.flush()
    weights = [w for *_, w in SAMPLE_BRANCHES]

    # Customers: growing sign-ups across the last 18 months.
    plan_ids = ["spark", "surge", "apex"]
    plan_w = [0.45, 0.38, 0.17]
    customers = []
    for back in range(17, -1, -1):
        start = _month_start(today, back)
        n_new = int((14 + (17 - back) * 1.6) * rng.uniform(0.85, 1.15))
        for _ in range(n_new):
            day = rng.randint(1, 28)
            joined = date(start.year, start.month, day)
            if joined > today:
                joined = today
            branch = rng.choices(branches, weights)[0]
            first, last = rng.choice(FIRST), rng.choice(LAST)
            customers.append(Customer(
                name=f"{first} {last}", email=f"{first}.{last}{rng.randint(1, 999)}@example.com".lower(),
                phone=f"+91 90000 {rng.randint(10000, 99999)}", plan=rng.choices(plan_ids, plan_w)[0],
                branch_id=branch.id, joined_at=joined, is_sample=True,
            ))
    db.add_all(customers)
    db.flush()

    for c in customers:  # a small share of members lapse each month
        months_active = (today.year - c.joined_at.year) * 12 + today.month - c.joined_at.month
        if any(rng.random() < 0.035 for _ in range(months_active)):
            c.is_active = False

    # Inquiries: ~12 months, trending up; older ones are mostly handled.
    inquiries = []
    cities = list(CITY_TO_STATE)[:]
    local_cities = [b[1] for b in SAMPLE_BRANCHES]
    for back in range(11, -1, -1):
        for _ in range(int((7 + (11 - back) * 1.1) * rng.uniform(0.8, 1.2))):
            when = datetime.combine(_month_start(today, back), datetime.min.time()) + timedelta(
                days=rng.randint(0, 27), hours=rng.randint(7, 22), minutes=rng.randint(0, 59))
            if when > utcnow():
                when = utcnow() - timedelta(hours=rng.randint(1, 72))
            age_days = (utcnow() - when).days
            handled = rng.random() < (0.95 if age_days > 14 else 0.35)
            first, last = rng.choice(FIRST), rng.choice(LAST)
            inquiries.append(Inquiry(
                name=f"{first} {last}", email=f"{first}.{last}{rng.randint(1, 99)}@example.com".lower(),
                phone=f"+91 90000 {rng.randint(10000, 99999)}",
                city=rng.choice(local_cities if rng.random() < 0.8 else cities),
                message=rng.choice(MESSAGES), status=INQUIRY_HANDLED if handled else INQUIRY_NEW,
                created_at=when, is_sample=True,
                handled_at=when + timedelta(hours=rng.randint(1, 30)) if handled else None,
                handled_by=settings.admin_username if handled else None,
            ))
    db.add_all(inquiries)
    db.add(AppMeta(key="sample_seeded", value=today.isoformat()))
    db.commit()
    log.info("Seeded %d customers, %d inquiries", len(customers), len(inquiries))
