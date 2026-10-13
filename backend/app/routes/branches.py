from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..cities import CITIES, CITY_TO_STATE
from ..database import get_db
from ..models import Branch, Customer, MembershipApplication, RevenueRecord
from ..schemas import BranchCreate, BranchOut, BranchUpdate, CityOut
from ..security import get_current_admin

router = APIRouter(prefix="/api/admin", tags=["branches"], dependencies=[Depends(get_current_admin)])


def _out(branch: Branch, customer_count: int) -> BranchOut:
    out = BranchOut.model_validate(branch)
    out.customer_count = customer_count
    return out


@router.get("/cities", response_model=list[CityOut])
def list_cities():
    return [CityOut(city=c, state=s) for c, s in CITIES]


@router.get("/branches", response_model=list[BranchOut])
def list_branches(db: Session = Depends(get_db)):
    counts = dict(db.execute(select(Customer.branch_id, func.count()).group_by(Customer.branch_id)).all())
    branches = db.scalars(select(Branch).order_by(Branch.created_at.desc(), Branch.id.desc())).all()
    return [_out(b, counts.get(b.id, 0)) for b in branches]


@router.post("/branches", response_model=BranchOut, status_code=status.HTTP_201_CREATED)
def create_branch(payload: BranchCreate, db: Session = Depends(get_db)):
    branch = Branch(**payload.model_dump(), state=CITY_TO_STATE[payload.city])
    db.add(branch)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "A branch with this name already exists")
    return _out(branch, 0)


@router.patch("/branches/{branch_id}", response_model=BranchOut)
def update_branch(branch_id: int, payload: BranchUpdate, db: Session = Depends(get_db)):
    branch = db.get(Branch, branch_id)
    if branch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Branch not found")
    for field, value in payload.model_dump(exclude_unset=True, exclude_none=True).items():
        setattr(branch, field, value)
        if field == "city":
            branch.state = CITY_TO_STATE[value]
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "A branch with this name already exists")
    count = db.scalar(select(func.count()).select_from(Customer).where(Customer.branch_id == branch_id))
    return _out(branch, count or 0)


@router.delete("/branches/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_branch(
    branch_id: int,
    force: bool = Query(default=False, description="Also delete the branch's customers and revenue records"),
    db: Session = Depends(get_db),
):
    branch = db.get(Branch, branch_id)
    if branch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Branch not found")
    customers = db.scalar(select(func.count()).select_from(Customer).where(Customer.branch_id == branch_id)) or 0
    if customers and not force:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"This branch has {customers} customers. Deleting it removes them too; confirm to continue.",
        )
    db.execute(delete(RevenueRecord).where(RevenueRecord.branch_id == branch_id))
    db.execute(delete(Customer).where(Customer.branch_id == branch_id))
    db.execute(update(MembershipApplication).where(MembershipApplication.branch_id == branch_id).values(branch_id=None))
    db.delete(branch)
    db.commit()
