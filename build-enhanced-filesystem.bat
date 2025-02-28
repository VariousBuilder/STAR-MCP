@echo off
chcp 65001 > nul
echo STAR-MCP: 拡張ファイルシステムビルドスクリプト
echo --------------------------------------------------

set "SERVER_DIR=%~dp0servers\enhanced-filesystem"
cd "%SERVER_DIR%"

echo 現在のディレクトリ: %cd%

REM pnpmがインストールされているか確認
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo pnpmがインストールされていません。インストールします...
    npm install -g pnpm
    if %errorlevel% neq 0 (
        echo pnpmのインストールに失敗しました。
        exit /b 1
    )
    echo pnpmがインストールされました。
)

REM 依存関係のインストール
echo 依存関係をインストールしています...
call pnpm install
if %errorlevel% neq 0 (
    echo 依存関係のインストールに失敗しました。
    exit /b 1
)

REM ビルド実行
echo TypeScriptをビルドしています...
call pnpm run build
if %errorlevel% neq 0 (
    echo ビルドに失敗しました。
    exit /b 1
)

echo.
echo ビルドが完了しました！
echo 拡張ファイルシステムサーバーは次の場所で利用可能です:
echo %SERVER_DIR%\build\index.js
echo.
echo Claude設定ファイルが正しく更新されていることを確認してください:
echo command: node
echo args: ["%SERVER_DIR%\build\index.js", "C:\Users\%USERNAME%"]
echo.

pause
