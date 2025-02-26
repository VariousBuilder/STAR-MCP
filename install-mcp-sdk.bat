@echo off
echo ======================================
echo STAR-MCP SDK インストールスクリプト
echo ======================================
cd "%~dp0"
echo 現在のディレクトリ: %CD%

echo MCP SDKをインストールします...
npm install @modelcontextprotocol/sdk@latest --save

echo 依存関係をインストールします...
npm install

echo ======================================
echo インストール完了！
echo ======================================
pause
