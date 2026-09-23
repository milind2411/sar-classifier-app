"""
Structured logging configuration for SAR Vessel/Iceberg Classifier backend.

Outputs formatted logs to stdout, making it suitable for local execution,
Docker containers, and cloud environments where stdout is captured.
Log level defaults to INFO, configurable via the LOG_LEVEL environment variable.
"""

import logging
import os
import sys

DEFAULT_LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"
DEFAULT_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"


def setup_logging(
    level: str = None,
    log_format: str = DEFAULT_LOG_FORMAT,
    date_format: str = DEFAULT_DATE_FORMAT,
) -> logging.Logger:
    """
    Configure root and application loggers to output structured logs to stdout.
    
    Args:
        level: Optional log level string (DEBUG, INFO, WARNING, ERROR, CRITICAL).
               Defaults to the LOG_LEVEL environment variable, or INFO.
        log_format: Format string for log messages.
        date_format: Format string for timestamps.
    """
    if level is None:
        level = os.getenv("LOG_LEVEL", "INFO").upper()

    numeric_level = getattr(logging, level, logging.INFO)

    # Create stdout stream handler
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(numeric_level)
    formatter = logging.Formatter(fmt=log_format, datefmt=date_format)
    handler.setFormatter(formatter)

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)

    # Avoid duplicate stdout handlers if setup_logging is called multiple times
    root_logger.handlers = [
        h for h in root_logger.handlers
        if not (isinstance(h, logging.StreamHandler) and h.stream == sys.stdout)
    ]
    root_logger.addHandler(handler)

    # Configure application root logger
    app_logger = logging.getLogger("sar_classifier")
    app_logger.setLevel(numeric_level)

    return app_logger


def get_logger(name: str = "sar_classifier") -> logging.Logger:
    """Return a logger instance for the given module/component name."""
    if name == "sar_classifier" or name.startswith("sar_classifier."):
        return logging.getLogger(name)
    return logging.getLogger(f"sar_classifier.{name}")
