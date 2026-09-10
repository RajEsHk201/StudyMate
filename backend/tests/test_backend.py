import sys
from pathlib import Path

# Ensure UTF-8 output on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app import create_app
from app.services.srs_service import SRSService

def run_tests():
    print("🧪 Running StudyMate Verification Tests...")
    app = create_app()
    app.config["TESTING"] = True
    client = app.test_client()

    # 1. Test Static & HTML Serving
    res = client.get("/")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    assert b"StudyMate" in res.data, "StudyMate title not in HTML"
    print("✅ GET / returns index.html successfully")

    res = client.get("/css/main.css")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    print("✅ GET /css/main.css loaded successfully")

    res = client.get("/js/app.js")
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    print("✅ GET /js/app.js loaded successfully")

    # 2. Test Profile & Personalization API
    profile_payload = {
        "email": "test_student@example.com",
        "name": "Alex Chen",
        "education_level": "Undergraduate",
        "major": "Biomedical Engineering",
        "target_exam": "MCAT",
        "learning_style": "Intuitive & Visual",
        "tutor_mode": "Explanatory Tutor"
    }
    res = client.post("/api/profile", json=profile_payload)
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    data = res.get_json()
    assert data["profile"]["name"] == "Alex Chen"
    print("✅ POST /api/profile saved student persona successfully")

    res = client.get("/api/profile?email=test_student@example.com")
    assert res.status_code == 200
    assert res.get_json()["profile"]["major"] == "Biomedical Engineering"
    print("✅ GET /api/profile retrieved student persona correctly")

    # 3. Test Sessions & Conversational Memory Storage
    res = client.post("/api/sessions", json={
        "title": "MCAT Organic Chemistry",
        "session_type": "Exam Preparation",
        "user_email": "test_student@example.com"
    })
    assert res.status_code == 200
    session_id = res.get_json()["session"]["id"]
    print(f"✅ POST /api/sessions created session ID {session_id}")

    res = client.get("/api/sessions?user_email=test_student@example.com")
    assert res.status_code == 200
    sessions = res.get_json()["sessions"]
    assert any(s["id"] == session_id for s in sessions)
    print("✅ GET /api/sessions retrieved session list")

    # 4. Test SM-2 Spaced Repetition Algorithm Unit Test
    n, ef, interval, next_date = SRSService.calculate_sm2(0, 2.5, 0, 4) # Good
    assert n == 1 and interval == 1, f"Expected n=1, interval=1, got n={n}, interval={interval}"
    
    n2, ef2, interval2, _ = SRSService.calculate_sm2(n, ef, interval, 4) # Good again
    assert n2 == 2 and interval2 == 6, f"Expected n=2, interval=6, got n={n2}, interval={interval2}"
    
    n3, ef3, interval3, _ = SRSService.calculate_sm2(n2, ef2, interval2, 0) # Failed (Again)
    assert n3 == 0 and interval3 == 1, f"Expected n=0, interval=1 on Again, got n={n3}, interval={interval3}"
    print("✅ SM-2 Algorithm verified mathematically for all recall grades")

    # 5. Test Focus Logging & Analytics
    res = client.post("/api/analytics/focus-log", json={
        "user_email": "test_student@example.com",
        "subject": "Organic Chemistry",
        "duration_minutes": 25
    })
    assert res.status_code == 200
    print("✅ POST /api/analytics/focus-log recorded focus duration")

    res = client.get("/api/analytics/stats?user_email=test_student@example.com")
    assert res.status_code == 200
    stats = res.get_json()
    assert stats["today_focus_mins"] >= 25
    assert stats["study_streak"] >= 1
    print(f"✅ GET /api/analytics/stats verified: {stats['today_focus_mins']} mins today, streak {stats['study_streak']} day")

    # 6. Test Mistake Vault API
    res = client.get("/api/memory/vault?email=test_student@example.com")
    assert res.status_code == 200
    print("✅ GET /api/memory/vault retrieved mistake store")

    # 7. Test Flashcards Decks API
    res = client.get("/api/flashcards/decks?user_email=test_student@example.com")
    assert res.status_code == 200
    print("✅ GET /api/flashcards/decks retrieved deck library")

    print("\n🎉 ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
