@echo off
echo STAR-MCP: Config Check Script
echo -----------------------------------------

REM PowerShellスクリプトを実行
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0validate-config.ps1"

echo.
pause
