import os
import sys
from pathlib import Path

# 确保 tests 可以直接导入 server/app
SERVER_ROOT = Path(__file__).resolve().parents[1]
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))
