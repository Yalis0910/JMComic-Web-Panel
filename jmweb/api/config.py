import os
from fastapi import APIRouter, HTTPException, Body
from jmcomic import JmOption
from pathlib import Path

router = APIRouter(tags=["config"])

CONFIG_DIR = Path(__file__).parent.parent.parent / "config"
CONFIG_FILE = CONFIG_DIR / "option.yml"


def ensure_config_file():
    if not CONFIG_DIR.exists():
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    if not CONFIG_FILE.exists():
        option = JmOption.default()
        option.to_file(str(CONFIG_FILE))


def get_config_path():
    ensure_config_file()
    return str(CONFIG_FILE)


@router.get("/config")
async def get_config():
    try:
        config_path = get_config_path()
        option = JmOption.from_file(config_path)
        return {
            "code": 0,
            "data": option.deconstruct(),
            "message": "success",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/config")
async def update_config(config_data: dict = Body(...)):
    try:
        config_path = get_config_path()
        current_option = JmOption.from_file(config_path)
        current_dict = current_option.deconstruct()
        
        def deep_merge(base: dict, update: dict) -> dict:
            result = base.copy()
            for key, value in update.items():
                if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                    result[key] = deep_merge(result[key], value)
                else:
                    result[key] = value
            return result
        
        merged_config = deep_merge(current_dict, config_data)
        option = JmOption.construct(merged_config, cover_default=False)
        option.to_file(config_path)
        return {
            "code": 0,
            "data": option.deconstruct(),
            "message": "配置已保存",
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/config/load")
async def load_config(filepath: str = Body(...)):
    try:
        if not os.path.exists(filepath):
            raise HTTPException(status_code=404, detail="配置文件不存在")

        option = JmOption.from_file(filepath)
        return {
            "code": 0,
            "data": option.deconstruct(),
            "message": "配置文件已加载",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/config/save")
async def save_config(
    filepath: str = Body(...),
    config_data: dict = Body(...),
):
    try:
        option = JmOption.construct(config_data, cover_default=False)
        option.to_file(filepath)
        return {"code": 0, "data": None, "message": f"配置已保存到 {filepath}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))