import threading
import time
from typing import Optional, Dict
from jmcomic import JmOption


class SessionManager:
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._client = None
                cls._instance._option = None
                cls._instance._username: str = ""
                cls._instance._login_time: float = 0
            return cls._instance

    @property
    def is_logged_in(self) -> bool:
        return self._client is not None

    @property
    def username(self) -> str:
        return self._username

    def login(self, username: str, password: str, impl: str = "html"):
        option = JmOption.default()
        option.client.impl = impl
        client = option.new_jm_client()
        client.login(username=username, password=password)

        self._client = client
        self._option = option
        self._username = username
        self._login_time = time.time()

    def logout(self):
        self._client = None
        self._option = None
        self._username = ""
        self._login_time = 0

    def get_client(self):
        return self._client

    def get_status(self) -> dict:
        return {
            "is_logged_in": self.is_logged_in,
            "username": self._username,
            "login_time": self._login_time,
        }


session = SessionManager()