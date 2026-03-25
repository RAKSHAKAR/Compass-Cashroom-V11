"""
Comprehensive Seed Script for Real Users.
Populates the database with 90 days of realistic history for @compass.com accounts.
"""
import sys, os, uuid, random
from datetime import date, datetime, timedelta, timezone
from sqlalchemy.orm import Session

# Ensure app is importable
sys.path.insert(0, os.path.dirname(__file__))

from app.db.session import SessionLocal
from app.models.user import User, UserRole
from app.models.location import Location
from app.models.submission import Submission, SubmissionStatus, SubmissionSource, MissedSubmission
from app.models.audit import AuditEvent
from app.models.verification import Verification, VerificationType, VerificationStatus
from app.core.security import hash_password

# ── Configuration ────────────────────────────────────────────────────────────
TODAY = date.today()
DEMO_PASSWORD = "demo1234"
random.seed(1337) # Distinct seed for real data


# STRICTLY REAL ACCOUNTS (Must authenticate via Backend API)
# Real Production Accounts
USERS = [
    {"email": "admin@compass.com", "name": "Admin", "role": UserRole.ADMIN, "location_ids": []},
    {"email": "operator@compass.com", "name": "Operator", "role": UserRole.OPERATOR, "location_ids": ["loc-1"]},
    {"email": "controller@compass.com", "name": "Controller", "role": UserRole.CONTROLLER, "location_ids": ["loc-1", "loc-2", "loc-3"]},
    {"email": "dgm@compass.com", "name": "DGM", "role": UserRole.DGM, "location_ids": ["loc-1", "loc-2", "loc-3"]},
    {"email": "rc@compass.com", "name": "Regional Controller", "role": UserRole.REGIONAL_CONTROLLER, "location_ids": ["loc-1", "loc-2", "loc-3"]},
]

LOCATIONS = [
    {"id": "loc-1", "name": "NYC - Times Square", "cc": "1001", "cash": 5000.00},
    {"id": "loc-2", "name": "CHI - Millenium Park", "cc": "2005", "cash": 7500.00},
    {"id": "loc-3", "name": "LAX - Santa Monica", "cc": "3099", "cash": 4200.00},
]

def dt_utc(d: date, hour: int):
    return datetime.combine(d, datetime.min.time().replace(hour=hour)).replace(tzinfo=timezone.utc)

def seed_locations(db: Session):
    print("🌱 Seeding real locations...")

    locations_data = [
        {
            "id": "loc-1",
            "name": "Corporate HQ Cafe",
            "cost_center": "10010",
            "city": "New York",
            "expected_cash": 9575.00,
            "sla_hours": 48,
            "active": True
        },
        {
            "id": "loc-2",
            "name": "Metro Hospital Dining",
            "cost_center": "20450",
            "city": "Chicago",
            "expected_cash": 12000.00,
            "sla_hours": 48,
            "active": True
        },
        {
            "id": "loc-3",
            "name": "State University Food Court",
            "cost_center": "31900",
            "city": "Boston",
            "expected_cash": 15500.00,
            "sla_hours": 48,
            "active": True
        },
        {
            "id": "loc-4",
            "name": "Tech Park Vending Route",
            "cost_center": "40020",
            "city": "Austin",
            "expected_cash": 4500.00,
            "sla_hours": 48,
            "active": True
        },
        {
            "id": "loc-5",
            "name": "Downtown Arena Concessions",
            "cost_center": "55080",
            "city": "Denver",
            "expected_cash": 25000.00,
            "sla_hours": 24,     
            "active": True
        },
        {
            "id": "loc-6",
            "name": "Airport Terminal C Kiosks",
            "cost_center": "66010",
            "city": "Atlanta",
            "expected_cash": 8000.00,
            "sla_hours": 48,
            "active": True
        }
    ]

    added_count = 0
    updated_count = 0

    for loc in locations_data:
        # Check by ID so we can update the existing rows
        existing = db.query(Location).filter(Location.id == loc["id"]).first()
        
        if not existing:
            new_location = Location(
                id=loc["id"], 
                name=loc["name"],
                cost_center=loc["cost_center"],
                city=loc["city"],
                expected_cash=loc["expected_cash"],
                sla_hours=loc["sla_hours"],
                active=loc["active"]
            )
            db.add(new_location)
            added_count += 1
        else:
            # Update the existing cost center to remove the "CC-" prefix
            if existing.cost_center != loc["cost_center"]:
                existing.cost_center = loc["cost_center"]
                updated_count += 1
                print(f"  updated cost center for {loc['name']} to {loc['cost_center']}")

    db.commit()
    print(f"✅ Added {added_count} new locations and updated {updated_count} existing locations.\n")

def seed_users(db: Session):
    print("👥 Seeding real users...")
    created = 0
    skipped = 0
    for u in USERS:
        existing = db.query(User).filter(User.email == u["email"]).first()
        if existing:
            skipped += 1
            print(f"  skip user {u['email']} (already exists)")
            continue
        user = User(
            email=u["email"],
            name=u["name"],
            role=u["role"],
            hashed_password=hash_password(DEMO_PASSWORD),
            location_ids=u["location_ids"],
            active=True,
        )
        db.add(user)
        created += 1
        print(f"  create {u['email']}  role={u['role'].value}")
    db.commit()
    print(f"✅ Done — {created} users created, {skipped} users skipped.\n")

def generate_history(db: Session):
    from app.models.submission import Submission, SubmissionStatus, SubmissionSource
    from app.models.verification import Verification, VerificationType, VerificationStatus
    print("⏳ Generating 90 days of historical data for real users...")
    
    # Clean up old demo pollution before generating fresh data
    db.query(Submission).delete()
    db.query(Verification).delete()
    db.commit()

    all_locs = db.query(Location).all()
    today = date.today()
    subs_added = 0
    verifs_added = 0

    for i in range(90, -1, -1):
        curr_date = today - timedelta(days=i)
        is_weekend = curr_date.weekday() >= 5
        
        for loc in all_locs:
            if is_weekend and random.random() > 0.2: continue

            # Generate Submissions
            r = random.random()
            status = SubmissionStatus.APPROVED
            if i == 0: status = SubmissionStatus.PENDING_APPROVAL
            elif r < 0.05: status = SubmissionStatus.REJECTED

            actual = loc.expected_cash + random.uniform(-10, 10)
            sub = Submission(
                id=f"sub-{curr_date.strftime('%Y%m%d')}-{loc.id}",
                location_id=loc.id,
                operator_id="operator@compass.com",
                submission_date=curr_date,
                total_cash=actual,
                status=status,
                source=SubmissionSource.MANUAL,
                created_at=datetime.combine(curr_date, datetime.min.time().replace(hour=17)).replace(tzinfo=timezone.utc)
            )
            db.add(sub)
            subs_added += 1

            # Generate DGM Verifications (Once a month)
            if curr_date.day == 15 and i > 0:  # Mid-month visit
                verif = Verification(
                    id=f"ver-dgm-{curr_date.strftime('%Y%m')}-{loc.id}",
                    location_id=loc.id,
                    verifier_id="dgm@compass.com",
                    verifier_name="DGM",
                    verification_type=VerificationType.DGM,
                    verification_date=curr_date.strftime('%Y-%m-%d'),
                    status=VerificationStatus.COMPLETED,
                    observed_total=actual,
                    notes="Monthly DGM verification completed.",
                    created_at=datetime.combine(curr_date, datetime.min.time().replace(hour=10)).replace(tzinfo=timezone.utc)
                )
                db.add(verif)
                verifs_added += 1
                
    db.commit()
    print(f"✅ Generated {subs_added} submissions and {verifs_added} verifications.\n")

def seed() -> None:
    db = SessionLocal()
    try:
        # Seed locations first so the Foreign Key constraints (if any) are satisfied
        seed_locations(db)
        # Seed users next
        seed_users(db)
        # Generate realistic backend history
        generate_history(db)
    except Exception as e:
        print(f"❌ Error during seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed()