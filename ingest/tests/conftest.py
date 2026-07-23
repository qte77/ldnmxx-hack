"""Make ingest/ importable from the tests regardless of pytest's rootdir (repo root or ingest/)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
