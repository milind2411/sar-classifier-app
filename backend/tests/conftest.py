"""
Pytest configuration and fixtures for the SAR Classifier backend test suite.
"""

import os
import sys
from pathlib import Path
import pytest

# Ensure backend root is in sys.path
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import history

# Mark that tests are running to guard real production history from test noise
os.environ["TESTING"] = "1"


@pytest.fixture(autouse=True)
def isolated_predictions_db(tmp_path, monkeypatch):
    """
    Ensure each test runs with an isolated, temporary SQLite database in tmp_path,
    preventing any test executions from polluting backend/data/predictions.db.
    """
    test_db = tmp_path / "test_predictions.db"
    monkeypatch.setenv("PREDICTIONS_DB_PATH", str(test_db))
    history.set_db_path(test_db)
    yield test_db
    # Reset path back to default
    history.set_db_path(history.DEFAULT_DB_PATH)


@pytest.fixture(autouse=True)
def reset_rate_limiter():
    """
    Reset slowapi rate limits before and after each test to prevent rate limit
    counters from leaking across independent test cases.
    """
    from limiter import limiter
    limiter.reset()
    yield
    limiter.reset()
