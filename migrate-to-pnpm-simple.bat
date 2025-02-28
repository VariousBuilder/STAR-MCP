@echo off
chcp 65001 > nul
echo STAR-MCP: npm/npx から pnpm への移行スクリプト(シンプル版)
echo --------------------------------------------

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

REM インストール中のプロジェクトパスを保存
set "PROJECT_ROOT=%cd%"
echo プロジェクトルート: %PROJECT_ROOT%

REM package.jsonが存在するか確認
if not exist "%PROJECT_ROOT%\package.json" (
    echo package.jsonが見つかりません。
    exit /b 1
)

REM package.jsonのバックアップを作成
echo package.jsonのバックアップを作成しています...
copy "%PROJECT_ROOT%\package.json" "%PROJECT_ROOT%\package.json.backup"
if %errorlevel% neq 0 (
    echo バックアップの作成に失敗しました。
    exit /b 1
)
echo バックアップが作成されました: package.json.backup

REM node_modulesが存在する場合は削除
if exist "%PROJECT_ROOT%\node_modules" (
    echo 既存のnode_modulesを削除しています...
    rmdir /s /q "%PROJECT_ROOT%\node_modules"
    if %errorlevel% neq 0 (
        echo node_modulesの削除に失敗しました。
        exit /b 1
    )
)

REM package-lock.jsonが存在する場合は削除
if exist "%PROJECT_ROOT%\package-lock.json" (
    echo package-lock.jsonを削除しています...
    del "%PROJECT_ROOT%\package-lock.json"
)

REM pnpmを使用してパッケージをインストール
echo pnpmを使用してパッケージをインストールしています...
call pnpm install
if %errorlevel% neq 0 (
    echo パッケージのインストールに失敗しました。
    exit /b 1
)

echo 移行が完了しました。次にやるべきこと:
echo 1. Claude Desktop設定ファイルの'npx'コマンドを'pnpm dlx'に置き換える
echo 2. 'npm run'コマンドを'pnpm run'に置き換える

echo.
echo スクリプトが完了しました！
pause
