@echo off
echo Installing Enhanced Filesystem MCP Server dependencies...
cd /d "%~dp0"
npm install
echo Building server...
npm run build
echo Installation complete!
echo.
echo To use this server in Claude Desktop, add the following to your claude_desktop_config.json:
echo.
echo {
echo   "mcpServers": {
echo     "enhanced-filesystem": {
echo       "command": "node",
echo       "args": [
echo         "%~dp0build\index.js",
echo         "C:\Users\tomoy"
echo       ]
echo     }
echo   }
echo }
echo.
pause
