@echo off
chcp 65001 >nul
title JMComic Web Panel
echo ==========================================
echo    JMComic Web Panel 启动脚本
echo ==========================================
echo.

REM 切换到项目目录
cd /d "%~dp0"

REM 检查 Python 是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo [错误] 未检测到 Python，请先安装 Python 3.8+
    pause
    exit /b 1
)

echo [1/3] Python 版本:
python --version
echo.

REM 检查是否已安装依赖
echo [2/3] 检查依赖...
python -c "import fastapi" >nul 2>&1
if errorlevel 1 (
    echo [提示] 检测到依赖未安装，正在安装...
    pip install -e .
    if errorlevel 1 (
        echo [错误] 依赖安装失败
        pause
        exit /b 1
    )
) else (
    echo [OK] 依赖已安装
)
echo.

REM 启动 Web 服务
echo [3/3] 启动 Web 服务...
echo 服务地址: http://127.0.0.1:8800
echo 按 Ctrl+C 停止服务
echo.
echo ==========================================

python -m jmweb.main

if errorlevel 1 (
    echo.
    echo [错误] 服务启动失败
    pause
)
