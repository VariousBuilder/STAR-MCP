@echo off
echo STAR-MCP: Config Backup
echo --------------------------------

REM Set paths
set "CONFIG_FILE=%APPDATA%\Claude\claude_desktop_config.json"
set "BACKUP_DIR=%~dp0backups"
set "DATE_TIME=%date:~-4,4%%date:~-7,2%%date:~-10,2%_%time:~0,2%%time:~3,2%%time:~6,2%"
set DATE_TIME=%DATE_TIME: =0%

REM Create backup directory
if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

REM Check if config file exists
if exist "%CONFIG_FILE%" (
    echo Config file exists, creating backup...
    copy "%CONFIG_FILE%" "%BACKUP_DIR%\claude_desktop_config_%DATE_TIME%.json"
    echo Backup created: %BACKUP_DIR%\claude_desktop_config_%DATE_TIME%.json
) else (
    echo Config file not found: %CONFIG_FILE%
)

echo.
echo Press any key to exit...
pause > nul
