@echo off
echo ====================================
echo STAR-MCP サーバーセットアップスクリプト
echo ====================================
echo 実行日時: %date% %time%

cd "%~dp0"
echo 現在のディレクトリ: %CD%

echo ステップ1: 依存関係のインストール...
cd core
npm install
cd ..

echo ステップ2: プロジェクトレベルの依存関係インストール...
npm install

echo ステップ3: 共有データディレクトリの確認...
if not exist shared\data mkdir shared\data

echo ステップ4: MCPサーバーの実行...
echo Claude Desktop configファイルの確認と必要に応じた更新を行います

if exist "%APPDATA%\Claude\claude_desktop_config.json" (
    echo Claude Desktop configファイルが見つかりました
) else (
    echo Claude Desktop configファイルが見つかりません。新規作成します...
    if not exist "%APPDATA%\Claude" mkdir "%APPDATA%\Claude"
    copy claude_desktop_config.json "%APPDATA%\Claude\claude_desktop_config.json"
)

echo ====================================
echo セットアップ完了！
echo これで「npm run start:core」コマンドでSTAR-MCPコアを起動できます
echo ====================================

echo 何かキーを押すと終了します...
pause > nul
