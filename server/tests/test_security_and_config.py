from pathlib import Path

import pytest

from app.core.config import ConfigManager, build_proxy_uri
from app.core.security import decrypt_secret, encrypt_secret, hash_pin, verify_pin


def test_aes_gcm_roundtrip(tmp_path: Path):
    key_path = tmp_path / ".secret.key"
    secret = "p@ssw0rd_中文!"
    enc = encrypt_secret(secret, key_path=key_path)
    assert enc != secret
    assert decrypt_secret(enc, key_path=key_path) == secret


def test_pin_hash_verify():
    hashed = hash_pin("2580")
    assert verify_pin("2580", hashed) is True
    assert verify_pin("0000", hashed) is False


def test_config_manager_syncs_option(tmp_path: Path):
    mgr = ConfigManager(data_dir=tmp_path)
    settings = mgr.get_settings()
    assert settings.client_impl == "api"

    updated = mgr.update_settings(
        {
            "client_impl": "html",
            "image_cache_max_files": 777,
            "image_cache_max_size_mb": 512,
        }
    )
    assert updated.client_impl == "html"
    assert updated.image_cache_max_files == 777
    assert updated.image_cache_max_size_mb == 512

    opt_dict = mgr.get_option_dict()
    assert opt_dict["client"]["impl"] == "html"


def test_build_proxy_uri_and_toggle(tmp_path: Path):
    assert build_proxy_uri("http://127.0.0.1:7890", "alice", "p@ss:1#") == (
        "http://alice:p%40ss%3A1%23@127.0.0.1:7890"
    )
    assert build_proxy_uri("socks5://user:p%40ss@127.0.0.1:7891") == (
        "socks5://user:p%40ss@127.0.0.1:7891"
    )

    mgr = ConfigManager(data_dir=tmp_path)
    with pytest.raises(ValueError):
        mgr.update_settings({"proxy_enabled": True, "proxy_url": ""})

    enabled = mgr.update_settings(
        {
            "proxy_enabled": True,
            "proxy_url": "http://127.0.0.1:7890",
            "proxy_username": "alice",
            "proxy_password": "p@ss",
        }
    )
    assert enabled.proxy_enabled is True
    assert mgr.get_option_dict()["client"]["postman"]["meta_data"]["proxies"] == (
        "http://alice:p%40ss@127.0.0.1:7890"
    )

    disabled = mgr.update_settings({"proxy_enabled": False})
    assert disabled.proxy_enabled is False
    assert disabled.proxy_url == "http://127.0.0.1:7890"
    assert disabled.proxy_username == "alice"
    assert disabled.proxy_password == "p@ss"
    assert mgr.get_option_dict()["client"]["postman"]["meta_data"]["proxies"] == {}


def test_probe_proxy_sync_handles_success_and_407(monkeypatch):
    from types import SimpleNamespace
    from app.api.v2 import system as system_api

    monkeypatch.setattr(
        system_api.jm_adapter,
        "get_api_client",
        lambda prefer_auth=False: SimpleNamespace(get_domain_list=lambda: ["www.cdnbtd.cc"]),
    )
    captured_headers = []

    def fake_get(url, **kwargs):
        captured_headers.append(kwargs.get("headers"))
        return SimpleNamespace(status_code=200)

    monkeypatch.setattr(system_api.curl_requests, "get", fake_get)
    ok_res = system_api._probe_proxy_sync("http://127.0.0.1:7890")
    assert ok_res["reachable"] is True
    assert ok_res["jm_reachable"] is True
    assert captured_headers[0] and "token" in captured_headers[0] and "tokenparam" in captured_headers[0]

    monkeypatch.setattr(
        system_api.curl_requests,
        "get",
        lambda url, **kwargs: SimpleNamespace(status_code=407),
    )
    auth_fail = system_api._probe_proxy_sync("http://bad:pass@127.0.0.1:7890")
    assert auth_fail["reachable"] is False
    assert auth_fail["status_code"] == 407
