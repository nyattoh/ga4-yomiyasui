"""GA4 Setup Automation (Tracking-as-Code) package."""

import warnings

# Suppress benign requests / urllib3 version mismatch warning on Windows Python 3.14
warnings.filterwarnings("ignore", message=".*urllib3.*")

__version__ = "0.1.0"
