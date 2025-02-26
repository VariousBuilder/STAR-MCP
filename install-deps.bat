@echo off
echo Installing dependencies for STAR-MCP...

cd "%~dp0"
echo Current directory: %CD%

echo Installing core dependencies...
cd core
npm install
cd ..

echo Installing project-level dependencies...
npm install

echo Creating shared data directory if it doesn't exist...
if not exist shared\data mkdir shared\data

echo Done! You can now use STAR-MCP.
echo To configure Claude Desktop, copy claude_desktop_config.json to:
echo C:\Users\tomoy\AppData\Roaming\Claude\claude_desktop_config.json
echo.
echo Press any key to exit...
pause > nul
