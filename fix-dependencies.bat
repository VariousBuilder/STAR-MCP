@echo off
echo ======================================
echo STAR-MCP 依存関係修復スクリプト
echo ======================================
echo 実行日時: %date% %time%

cd "%~dp0"
echo 現在のディレクトリ: %CD%

echo ステップ1: 既存のnode_modulesを削除...
if exist node_modules (
    echo 既存のnode_modulesを削除します...
    rd /s /q node_modules
)

if exist core\node_modules (
    echo コアのnode_modulesを削除します...
    rd /s /q core\node_modules
)

echo ステップ2: SDKパッケージのインストール...
echo @modelcontextprotocol/sdk をインストールします...
call npm install @modelcontextprotocol/sdk@latest --save

echo ステップ3: 必要な依存関係をインストール...
call npm install

echo ステップ4: uuid パッケージのインストール（レジリエントエージェント用）...
call npm install uuid@latest @types/uuid@latest --save-dev

echo ステップ5: TypeScriptのビルド...
call npm run build

echo ======================================
echo 依存関係の修復が完了しました！
echo ======================================

echo 何かキーを押すと終了します...
pause > nul
