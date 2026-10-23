import os

from dotenv import load_dotenv
from flask import Flask, jsonify
from flask_cors import CORS
from sqlalchemy.exc import IntegrityError, SQLAlchemyError

from models import db

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))


def create_app(config=None):
    app = Flask(__name__)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL", "")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    if config:
        app.config.update(config)
    if not app.config["SQLALCHEMY_DATABASE_URI"]:
        raise RuntimeError("DATABASE_URL is required. Point it at the shared mini_erp database.")

    origins = [origin.strip() for origin in os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")]
    CORS(app, resources={r"/api/*": {"origins": origins}})
    db.init_app(app)

    from routes import bp
    app.register_blueprint(bp)

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
