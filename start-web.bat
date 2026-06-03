@echo off
chcp 65001 >nul 2>&1
title JMComic Web Panel
echo ==========================================
echo    JMComic Web Panel
echo ==========================================
echo.

REM Switch to project directory
cd /d "%~dp0"

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python not found. Please install Python 3.8+
    pause
    exit /b 1
)

echo [1/3] Python Version:
python --version
echo.

REM Check dependencies
echo [2/3] Checking dependencies...
python -c "import fastapi, uvicorn" >nul 2>&1
if errorlevel 1 (
    echo [INFO] Installing dependencies...
    pip install -e .
    if errorlevel 1 (
        echo [ERROR] Failed to install dependencies
        pause
        exit /b 1
    )
) else (
    echo [OK] Dependencies installed
)
echo.

REM Start Web Server
echo [3/3] Starting Web Server...
echo URL: http://127.0.0.1:8800
echo Press Ctrl+C to stop
echo.
echo ==========================================

python -m jmweb.main

if errorlevel 1 (
    echo.
    echo [ERROR] Server failed to start
    pause
)
