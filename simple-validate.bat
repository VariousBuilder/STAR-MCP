@echo off
echo STAR-MCP: Simple Config Validation
echo -----------------------------------------

set "CONFIG_FILE=%APPDATA%\Claude\claude_desktop_config.json"

if exist "%CONFIG_FILE%" (
    echo Claude Desktop config file exists.
    
    echo.
    echo Checking JSON validity...
    powershell -Command "$json = Get-Content '%CONFIG_FILE%' | ConvertFrom-Json; if ($json) { Write-Host 'JSON is valid' } else { Write-Host 'JSON invalid' }"
    
    echo.
    echo Servers configured:
    powershell -Command "$json = Get-Content '%CONFIG_FILE%' | ConvertFrom-Json; $servers = $json.mcpServers.PSObject.Properties.Name; $servers | ForEach-Object { Write-Host ('- ' + $_) }"
) else (
    echo Claude Desktop config file not found.
)

echo.
echo Press any key to exit...
pause > nul
