import hmac
import os

from dotenv import load_dotenv
from flask import Flask, jsonify, request, session
from flask_cors import CORS
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from werkzeug.security import check_password_hash

from models import db

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
# In local development, the project .env should be the source of truth.
# override=True prevents an old system/user DATABASE_URL from being reused.
load_dotenv(os.path.join(BASE_DIR, ".env"), override=True)


def create_app(config=None):
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = os.environ.get("INVENTORY_SECRET_KEY", "change-this-inventory-secret")
    app.config["SESSION_COOKIE_HTTPONLY"] = True
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
    if config:
        app.config.update(config)
    if not app.config["SQLALCHEMY_DATABASE_URI"]:
        raise RuntimeError("DATABASE_URL is required. Point it at the shared mini_erp database.")

    origins = [origin.strip() for origin in os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")]
    CORS(app, resources={r"/api/*": {"origins": origins}}, supports_credentials=True)
    db.init_app(app)

    from routes import bp
    app.register_blueprint(bp)

    @app.post("/api/auth/login")
    def login():
        data = request.get_json(silent=True) or {}
        username = str(data.get("username", "")).strip()
        password = str(data.get("password", ""))
        expected_username = os.environ.get("INVENTORY_USERNAME", "inventory")
        expected_password = os.environ.get("INVENTORY_PASSWORD", "")
        expected_hash = os.environ.get("INVENTORY_PASSWORD_HASH", "")
        valid_password = check_password_hash(expected_hash, password) if expected_hash else hmac.compare_digest(password, expected_password)
        if not hmac.compare_digest(username, expected_username) or not valid_password:
            return jsonify({"error": "Invalid username or password."}), 401
        session.clear()
        session["inventory_user"] = username
        return jsonify({"username": username})

    @app.get("/api/auth/me")
    def current_user():
        username = session.get("inventory_user")
        if not username:
            return jsonify({"authenticated": False}), 401
        return jsonify({"authenticated": True, "username": username})

    @app.post("/api/auth/logout")
    def logout():
        session.clear()
        return jsonify({"success": True})

    @app.get("/health")
    def health():
        return jsonify({"status": "ok", "service": "inventory", "database": "shared mini_erp"})

    @app.errorhandler(404)
    def not_found(_):
        return jsonify({"error": "Not found"}), 404

    @app.errorhandler(405)
    def method_not_allowed(_):
        return jsonify({"error": "Method not allowed"}), 405

    @app.errorhandler(IntegrityError)
    def integrity_error(error):
        db.session.rollback()
        app.logger.warning("Database integrity error: %s", error.orig)
        return jsonify({"error": "The request conflicts with an existing record or database constraint."}), 409

    @app.errorhandler(SQLAlchemyError)
    def database_error(error):
        db.session.rollback()
        app.logger.exception("Database error: %s", error)
        return jsonify({"error": "Database operation failed."}), 500

    @app.errorhandler(500)
    def server_error(_):
        db.session.rollback()
        return jsonify({"error": "Internal server error"}), 500

    return app


app = create_app()

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", "5000")), debug=os.environ.get("FLASK_DEBUG", "0") == "1")
