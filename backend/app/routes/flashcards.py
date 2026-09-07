from flask import Blueprint, request, jsonify, Response
from ..services.srs_service import SRSService
from ..services.memory_service import MemoryService
import csv
import io

flashcards_bp = Blueprint("flashcards", __name__)

@flashcards_bp.route("/api/flashcards/generate", methods=["POST"])
def generate_flashcards():
    try:
        data = request.get_json() or {}
        topic = data.get("topic", "").strip()
        num_cards = int(data.get("num_cards", 8))
        user_email = data.get("user_email")
        context = data.get("context")

        if not topic:
            return jsonify({"error": "Topic is required to generate flashcards."}), 400

        user = MemoryService.get_or_create_user(user_email) if user_email else None
        user_id = user["id"] if user else None

        deck_data = SRSService.generate_deck(
            topic=topic,
            num_cards=min(max(num_cards, 4), 20),
            profile=user,
            context=context
        )

        title = deck_data.get("deck_title", f"Flashcards: {topic}")
        cards = deck_data.get("cards", [])

        # Save directly to database
        deck_id = SRSService.save_deck_to_db(user_id, title, topic, cards)
        saved_cards = SRSService.get_deck_cards(deck_id)

        return jsonify({
            "deck_id": deck_id,
            "title": title,
            "topic": topic,
            "cards": saved_cards
        })

    except Exception as e:
        print("Flashcards Generation Error:", e)
        return jsonify({"error": "Failed to generate flashcards.", "details": str(e)}), 500

@flashcards_bp.route("/api/flashcards/decks", methods=["GET"])
def list_decks():
    user_email = request.args.get("user_email")
    user = MemoryService.get_or_create_user(user_email) if user_email else None
    user_id = user["id"] if user else None
    decks = SRSService.get_decks(user_id)
    return jsonify({"decks": decks})

@flashcards_bp.route("/api/flashcards/decks/<int:deck_id>", methods=["GET"])
def get_deck(deck_id):
    cards = SRSService.get_deck_cards(deck_id)
    return jsonify({"cards": cards})

@flashcards_bp.route("/api/flashcards/review", methods=["POST"])
def review_card():
    try:
        data = request.get_json() or {}
        card_id = data.get("card_id")
        quality = int(data.get("quality", 4))

        if not card_id:
            return jsonify({"error": "card_id is required"}), 400

        update_info = SRSService.review_card(card_id, quality)
        return jsonify({"success": True, "card": update_info})

    except Exception as e:
        print("Flashcard Review Error:", e)
        return jsonify({"error": "Failed to update review.", "details": str(e)}), 500

@flashcards_bp.route("/api/flashcards/export/<int:deck_id>", methods=["GET"])
def export_anki(deck_id):
    cards = SRSService.get_deck_cards(deck_id)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Front", "Back", "Hint", "Tags"])
    for c in cards:
        writer.writerow([c["front"], c["back"], c["hint"], c["tag"]])
    
    return Response(
        output.getvalue(),
        mimetype="text/csv",
        headers={"Content-Disposition": f"attachment;filename=deck_{deck_id}_anki.csv"}
    )
