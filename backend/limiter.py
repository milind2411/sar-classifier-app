"""
Rate limiter configuration for SAR-Vision API using slowapi.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Client IP-based rate limiter with response header injection
limiter = Limiter(
    key_func=get_remote_address,
    headers_enabled=True,
)
