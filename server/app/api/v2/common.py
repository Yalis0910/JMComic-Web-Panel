from typing import Any


def ok(data: Any = None, message: str = "success") -> dict:
    return {"code": 0, "data": data, "message": message}
