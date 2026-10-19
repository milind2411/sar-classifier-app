"""
Prediction history tracking using SQLite (built-in sqlite3).
Persists predictions made by the API into backend/data/predictions.db.
"""

import logging
import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

DEFAULT_DB_PATH = Path(__file__).parent / "data" / "predictions.db"
_current_db_path: Path = DEFAULT_DB_PATH


def get_db_path() -> Path:
    env_path = os.environ.get("PREDICTIONS_DB_PATH")
    if env_path:
        return Path(env_path)
    return _current_db_path


def set_db_path(path: Path):
    global _current_db_path
    _current_db_path = path
    init_db(path)


def init_db(db_path: Optional[Path] = None):
    """Initialize SQLite database and ensure predictions table exists."""
    target_path = db_path or get_db_path()
    target_path.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(target_path) as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                predicted_class TEXT NOT NULL,
                probability_iceberg REAL NOT NULL,
                confidence REAL NOT NULL,
                inc_angle REAL NOT NULL,
                model_used TEXT NOT NULL,
                source TEXT NOT NULL
            )
            """
        )
        cursor.execute(
            "CREATE INDEX IF NOT EXISTS idx_predictions_timestamp ON predictions(timestamp DESC)"
        )
        conn.commit()


def is_history_enabled() -> bool:
    """
    Check if prediction history collection and retrieval are enabled via environment variable.
    Defaults to True. If HISTORY_ENABLED is '0', 'false', 'no', or 'off', returns False.
    """
    val = os.environ.get("HISTORY_ENABLED", "true").strip().lower()
    return val not in ("0", "false", "no", "off")


def is_logging_enabled() -> bool:
    """
    Guard: if history is disabled, or if TESTING environment variable is set and we are pointing
    at the production default database, do not log to prevent test noise.
    """
    if not is_history_enabled():
        return False
    if os.environ.get("DISABLE_PREDICTION_LOGGING", "").lower() in ("1", "true", "yes"):
        return False
    is_testing = os.environ.get("TESTING", "").lower() in ("1", "true", "yes")
    if is_testing and get_db_path().resolve() == DEFAULT_DB_PATH.resolve():
        return False
    return True



def log_prediction(
    predicted_class: str,
    probability_iceberg: float,
    confidence: float,
    inc_angle: float,
    model_used: str = "resnet50",
    source: str = "predict",
    timestamp: Optional[str] = None,
) -> Optional[int]:
    """
    Insert a prediction record into the SQLite database.
    """
    if not is_logging_enabled():
        return None

    if timestamp is None:
        timestamp = datetime.now(timezone.utc).isoformat()

    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    try:
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                INSERT INTO predictions (
                    timestamp, predicted_class, probability_iceberg,
                    confidence, inc_angle, model_used, source
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    timestamp,
                    predicted_class,
                    float(probability_iceberg),
                    float(confidence),
                    float(inc_angle),
                    model_used,
                    source,
                ),
            )
            conn.commit()
            return cursor.lastrowid
    except Exception as e:
        logger.error(f"Failed to log prediction to {db_path}: {e}")
        return None


def get_history(limit: int = 50) -> List[Dict[str, Any]]:
    """
    Fetch the most recent predictions ordered newest-first (capped at 200).
    """
    limit = min(max(1, limit), 200)
    db_path = get_db_path()
    if not db_path.exists():
        return []

    try:
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT id, timestamp, predicted_class, probability_iceberg,
                       confidence, inc_angle, model_used, source
                FROM predictions
                ORDER BY id DESC
                LIMIT ?
                """,
                (limit,),
            )
            rows = cursor.fetchall()
            return [dict(row) for row in rows]
    except Exception as e:
        logger.error(f"Failed to fetch history from {db_path}: {e}")
        return []


# On import, initialize database at backend/data/predictions.db
init_db(DEFAULT_DB_PATH)
