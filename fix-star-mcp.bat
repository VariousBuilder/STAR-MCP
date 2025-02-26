@echo off
echo ======================================
echo STAR-MCP 総合修復スクリプト
echo ======================================
echo 実行日時: %date% %time%

cd "%~dp0"
echo 現在のディレクトリ: %CD%

echo ステップ1: ディレクトリ構造確認...
if not exist node_modules (
    mkdir node_modules
    echo node_modulesディレクトリを作成しました
)

if not exist shared (
    mkdir shared
    echo sharedディレクトリを作成しました
)

echo ステップ2: 依存関係修復...
call npm install @modelcontextprotocol/sdk@latest --save
call npm install

echo ステップ3: コアディレクトリの依存関係修復...
cd core
call npm install @modelcontextprotocol/sdk@latest --save
call npm install
cd ..

echo ステップ4: index.jsの修正を適用...
if exist core\index.js (
    echo バックアップを作成しています...
    copy core\index.js core\index.js.bak
    
    echo 修正済みindex.jsを利用します...
    copy core\index-fixed.js core\index.js
)

echo ステップ5: 設定を修正...
powershell -Command "(Get-Content -Path \"claude_desktop_config.json\") -replace 'index.js', 'index-fixed.js' | Set-Content -Path \"claude_desktop_config.json.new\""
if exist claude_desktop_config.json.new (
    move /Y claude_desktop_config.json.new claude_desktop_config.json
    echo claude_desktop_config.jsonを更新しました
)

echo ======================================
echo 修復が完了しました！
echo Claude for Desktopを再起動してください
echo ======================================

echo 何かキーを押すと終了します...
pause > nul
