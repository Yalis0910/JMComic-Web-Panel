import os
from fastapi import APIRouter, HTTPException, Body
from jmcomic import JmOption

router = APIRouter(tags=["config"])

DEFAULT_CONFIG_PATH = os.environ.get("JM_OPTION_PATH", "")


@router.get("/config")
async def get_config():
    try:
        if DEFAULT_CONFIG_PATH and os.path.exists(DEFAULT_CONFIG_PATH):
            option = JmOption.from_file(DEFAULT_CONFIG_PATH)
        else:
            option = JmOption.default()

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
        option = JmOption.construct(config_data)
        return {
            "code": 0,
            "data": option.deconstruct(),
            "message": "配置已更新",
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