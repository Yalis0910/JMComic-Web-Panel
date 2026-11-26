from pathlib import Path

from app.core.config import ConfigManager
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
