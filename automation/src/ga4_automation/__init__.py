"""GA4 自動セットアップ CLI"""

__version__ = "0.1.0"

from .client import GA4Client
from .errors import GA4NotFoundError, GA4PermissionError, GA4QuotaError

__all__ = [
    "GA4Client",
    "GA4NotFoundError",
    "GA4PermissionError", 
    "GA4QuotaError",
]
