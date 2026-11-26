@echo off
cd /d "%~dp0"
if exist "web\dist\index.html" goto :start_server
echo [JMlis] Building web frontend...
pushd web
call npm install
if errorlevel 1 goto :fail
call npm run build
if errorlevel 1 goto :fail
popd
:start_server
echo [JMlis] Starting server at http://127.0.0.1:8800 ...
set "PYTHONPATH=%~dp0server"
python -m app.main
goto :end
:fail
popd
echo [JMlis] Frontend build failed.
:end
pause
