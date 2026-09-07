from flask import Flask
from .config import Config
from .db import init_db

def create_app():
    app = Flask(__name__, static_folder=None)
    app.config.from_object(Config)

    # Initialize SQLite database tables
    init_db()

    # Register Blueprints
    from .routes.views import views_bp
    from .routes.chat import chat_bp
    from .routes.study import study_bp
    from .routes.quiz import quiz_bp
    from .routes.flashcards import flashcards_bp
    from .routes.profile import profile_bp
    from .routes.analytics import analytics_bp

    app.register_blueprint(views_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(study_bp)
    app.register_blueprint(quiz_bp)
    app.register_blueprint(flashcards_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(analytics_bp)

    return app
