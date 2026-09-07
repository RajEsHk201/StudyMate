from flask import Blueprint, send_from_directory, current_app
from ..config import Config

views_bp = Blueprint("views", __name__)

@views_bp.route("/")
def home():
    return send_from_directory(Config.FRONTEND_DIR, "index.html")

@views_bp.route("/<path:filename>")
def frontend_static(filename):
    return send_from_directory(Config.FRONTEND_DIR, filename)
