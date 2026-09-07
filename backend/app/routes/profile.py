from flask import Blueprint, request, jsonify
from ..services.memory_service import MemoryService

profile_bp = Blueprint("profile", __name__)

@profile_bp.route("/api/profile", methods=["GET"])
def get_profile():
    email = request.args.get("email")
    if not email:
        return jsonify({"error": "Email is required"}), 400
    user = MemoryService.get_or_create_user(email)
    return jsonify({"profile": user})

@profile_bp.route("/api/profile", methods=["POST"])
def update_profile():
    data = request.get_json() or {}
    email = data.get("email")
    if not email:
        return jsonify({"error": "Email is required"}), 400
    user = MemoryService.get_or_create_user(email)
    updated = MemoryService.update_user_profile(user["id"], data)
    return jsonify({"profile": updated or user})

@profile_bp.route("/api/memory/vault", methods=["GET"])
def get_vault():
    email = request.args.get("email")
    status = request.args.get("status", "all")
    user_id = None
    if email:
        user = MemoryService.get_or_create_user(email)
        user_id = user["id"]
    vault = MemoryService.get_mistake_vault(user_id, status=status)
    return jsonify({"vault": vault})

@profile_bp.route("/api/memory/resolve-mistake", methods=["POST"])
def resolve_mistake():
    data = request.get_json() or {}
    mistake_id = data.get("mistake_id")
    if not mistake_id:
        return jsonify({"error": "mistake_id required"}), 400
    MemoryService.resolve_mistake(mistake_id)
    return jsonify({"success": True})
