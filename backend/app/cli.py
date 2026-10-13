"""Maintenance commands:  python -m app.cli <command>

  clear-sample                Delete the demo data (keeps anything you added yourself)
  import customers FILE.csv   columns: name,email,phone,branch,plan,joined_at[,is_active]
  import revenue FILE.csv     columns: customer_email,branch,amount_inr,plan,paid_on
  set-admin-password          Change/reset the admin password
"""
import argparse
import csv
import getpass
from datetime import date

from sqlalchemy import delete, select

from .config import settings
from .database import Base, SessionLocal, engine
from .models import AdminUser, Branch, Customer, Inquiry, MembershipApplication, RevenueRecord
from .security import hash_password


def clear_sample() -> None:
    with SessionLocal() as db:
        db.execute(delete(RevenueRecord).where(RevenueRecord.is_sample))
        db.execute(delete(Inquiry).where(Inquiry.is_sample))
        db.execute(delete(MembershipApplication).where(MembershipApplication.is_sample))
        db.execute(delete(Customer).where(Customer.is_sample))
        sample_branches = db.scalars(select(Branch).where(Branch.is_sample)).all()
        kept = 0
        for b in sample_branches:
            if db.scalar(select(Customer.id).where(Customer.branch_id == b.id).limit(1)):
                kept += 1  # has real customers attached
            else:
                db.delete(b)
        db.commit()
    print("Sample data removed." + (f" {kept} sample branch(es) kept because real customers use them." if kept else ""))
    print("Set SEED_SAMPLE_DATA=false in backend/.env (the demo data is only re-created on a fresh database).")


def _read(path: str):
    with open(path, newline="", encoding="utf-8-sig") as f:
        yield from csv.DictReader(f)


def import_customers(path: str) -> None:
    with SessionLocal() as db:
        branches = {b.name: b.id for b in db.scalars(select(Branch))}
        n = 0
        for row in _read(path):
            if row["branch"] not in branches:
                raise SystemExit(f"Unknown branch '{row['branch']}' (create it in the admin dashboard first)")
            db.add(Customer(
                name=row["name"].strip(), email=row["email"].strip().lower(), phone=row["phone"].strip(),
                plan=row["plan"].strip().lower(), branch_id=branches[row["branch"]],
                joined_at=date.fromisoformat(row["joined_at"]),
                is_active=row.get("is_active", "true").strip().lower() not in ("0", "false", "no"),
            ))
            n += 1
        db.commit()
    print(f"Imported {n} customers.")


def import_revenue(path: str) -> None:
    with SessionLocal() as db:
        branches = {b.name: b.id for b in db.scalars(select(Branch))}
        customers = {c.email: c.id for c in db.scalars(select(Customer))}
        n = 0
        for row in _read(path):
            if row["branch"] not in branches:
                raise SystemExit(f"Unknown branch '{row['branch']}'")
            db.add(RevenueRecord(
                branch_id=branches[row["branch"]], customer_id=customers.get(row["customer_email"].strip().lower()),
                amount_inr=int(row["amount_inr"]), plan=row["plan"].strip().lower(),
                paid_on=date.fromisoformat(row["paid_on"]),
            ))
            n += 1
        db.commit()
    print(f"Imported {n} revenue records.")


def set_admin_password() -> None:
    pw = getpass.getpass("New admin password: ")
    if len(pw) < 10 or pw != getpass.getpass("Repeat: "):
        raise SystemExit("Passwords must match and be at least 10 characters.")
    with SessionLocal() as db:
        user = db.scalar(select(AdminUser).where(AdminUser.username == settings.admin_username))
        if user:
            user.password_hash = hash_password(pw)
        else:
            db.add(AdminUser(username=settings.admin_username, password_hash=hash_password(pw)))
        db.commit()
    print(f"Password updated for '{settings.admin_username}'.")


def main() -> None:
    Base.metadata.create_all(bind=engine)
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("clear-sample")
    sub.add_parser("set-admin-password")
    imp = sub.add_parser("import")
    imp.add_argument("kind", choices=["customers", "revenue"])
    imp.add_argument("file")
    args = p.parse_args()
    if args.cmd == "clear-sample":
        clear_sample()
    elif args.cmd == "set-admin-password":
        set_admin_password()
    else:
        (import_customers if args.kind == "customers" else import_revenue)(args.file)


if __name__ == "__main__":
    main()
