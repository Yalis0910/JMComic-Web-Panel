import threading
import time
import os
import json
import base64
from typing import Optional, Dict
from jmcomic import JmOption
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad


SESSION_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'session.json')

CRYPTO_KEY_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', '.crypto_key')


def _load_or_create_crypto_key() -> bytes:
    try:
        os.makedirs(os.path.dirname(CRYPTO_KEY_FILE), exist_ok=True)
        if os.path.exists(CRYPTO_KEY_FILE):
            with open(CRYPTO_KEY_FILE, 'rb') as f:
                return f.read()
        key = os.urandom(32)
        with open(CRYPTO_KEY_FILE, 'wb') as f:
            f.write(key)
        return key
    except Exception:
        return os.urandom(32)


CRYPTO_KEY = _load_or_create_crypto_key()


def _encrypt_password(password: str) -> str:
    cipher = AES.new(CRYPTO_KEY, AES.MODE_ECB)
    ct = cipher.encrypt(pad(password.encode('utf-8'), AES.block_size))
    return base64.b64encode(ct).decode('utf-8')


def _decrypt_password(encrypted: str) -> str:
    cipher = AES.new(CRYPTO_KEY, AES.MODE_ECB)
    pt = unpad(cipher.decrypt(base64.b64decode(encrypted)), AES.block_size)
    return pt.decode('utf-8')


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
                cls._instance._password_encrypted: str = ""
                cls._instance._login_time: float = 0
                cls._instance._impl: str = "html"
                cls._instance._try_restore_session()
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
        self._password_encrypted = _encrypt_password(password)
        self._login_time = time.time()
        self._impl = impl

        self._save_session()

    def logout(self):
        self._client = None
        self._option = None
        self._username = ""
        self._password_encrypted = ""
        self._login_time = 0
        self._impl = "html"

        self._delete_session()

    def get_client(self):
        return self._client

    def get_status(self) -> dict:
        return {
            "is_logged_in": self.is_logged_in,
            "username": self._username,
            "login_time": self._login_time,
        }

    def refresh_session(self) -> bool:
        """用保存的密码重新登录，刷新cookie。
        返回 True 表示刷新成功，False 表示失败（需要用户重新登录）。
        """
        if not self._username or not self._password_encrypted:
            return False

        try:
            password = _decrypt_password(self._password_encrypted)

            option = JmOption.default()
            option.client.impl = self._impl
            client = option.new_jm_client()
            client.login(username=self._username, password=password)

            self._client = client
            self._option = option
            self._login_time = time.time()

            self._save_session()

            print(f"[SessionManager] 已自动刷新登录状态: {self._username}")
            return True
        except Exception as e:
            print(f"[SessionManager] 自动刷新登录失败: {e}")
            return False

    def clear_session(self):
        """当请求返回401时调用，清除本地session"""
        self._client = None
        self._option = None
        self._username = ""
        self._password_encrypted = ""
        self._login_time = 0
        self._impl = "html"
        self._delete_session()

    def _save_session(self):
        if self._client is None:
            return

        try:
            cookies = dict(self._client['cookies'])
            session_data = {
                "username": self._username,
                "impl": self._impl,
                "cookies": cookies,
                "password_encrypted": self._password_encrypted,
                "login_time": self._login_time,
            }

            os.makedirs(os.path.dirname(SESSION_FILE), exist_ok=True)
            with open(SESSION_FILE, 'w', encoding='utf-8') as f:
                json.dump(session_data, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[SessionManager] 保存session失败: {e}")

    def _load_session(self) -> Optional[Dict]:
        try:
            if not os.path.exists(SESSION_FILE):
                return None

            with open(SESSION_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"[SessionManager] 加载session失败: {e}")
            return None

    def _delete_session(self):
        try:
            if os.path.exists(SESSION_FILE):
                os.remove(SESSION_FILE)
        except Exception as e:
            print(f"[SessionManager] 删除session失败: {e}")

    def _try_restore_session(self):
        session_data = self._load_session()
        if session_data is None:
            return

        try:
            username = session_data.get("username", "")
            impl = session_data.get("impl", "html")
            cookies = session_data.get("cookies", {})
            password_encrypted = session_data.get("password_encrypted", "")
            login_time = session_data.get("login_time", 0)

            if not cookies:
                return

            option = JmOption.default()
            option.client.impl = impl
            option.update_cookies(cookies)
            client = option.new_jm_client()

            self._client = client
            self._option = option
            self._username = username
            self._password_encrypted = password_encrypted
            self._login_time = login_time
            self._impl = impl

            print(f"[SessionManager] 已恢复登录状态: {username}")
        except Exception as e:
            print(f"[SessionManager] 恢复登录状态失败: {e}")
            self._delete_session()


session = SessionManager()