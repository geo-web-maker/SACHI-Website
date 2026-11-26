import sys
from pathlib import Path

# Make `import app...` work when pytest is run from backend/ or from the repo root.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
