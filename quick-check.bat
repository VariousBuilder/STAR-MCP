@echo off
echo STAR-MCP: Quick Server Check
echo --------------------------------

REM Claude Desktop config path
set "CONFIG_FILE=%APPDATA%\Claude\claude_desktop_config.json"

REM Log directory
set "LOG_DIR=%APPDATA%\Claude\logs"

echo Checking config file...
if exist "%CONFIG_FILE%" (
    echo - Config file exists
) else (
    echo - Config file NOT found!
)

echo.
echo Checking log directory...
if exist "%LOG_DIR%" (
    echo - Log directory exists
) else (
    echo - Log directory NOT found!
)

echo.
echo Recent log files:
powershell -Command "Get-ChildItem '%LOG_DIR%\mcp*.log' -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 3 | ForEach-Object { Write-Host ('- ' + $_.Name + ' (' + [math]::Round($_.Length / 1KB, 1) + ' KB)') }"

echo.
echo Press any key to exit...
pause > nul
