@echo off
chcp 65001 > nul
echo STAR-MCP: 全プロジェクトのpnpmへの移行スクリプト
echo ------------------------------------------------

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

REM 移行前にバックアップディレクトリを作成
set "BACKUP_DIR=%~dp0backups\%date:~0,4%%date:~5,2%%date:~8,2%"
mkdir "%BACKUP_DIR%" 2>nul

REM メインプロジェクトの移行
echo.
echo [1/4] メインプロジェクトを移行します...
call :migrate_project "%~dp0"

REM サーバーディレクトリの処理
echo.
echo [2/4] サーバーディレクトリを移行します...
for /d %%d in ("%~dp0servers\*") do (
    if exist "%%d\package.json" (
        echo 移行: %%~nd
        call :migrate_project "%%d"
    )
)

REM エージェントディレクトリの処理
echo.
echo [3/4] エージェントディレクトリを移行します...
for /d %%d in ("%~dp0agents\*") do (
    if exist "%%d\package.json" (
        echo 移行: %%~nd
        call :migrate_project "%%d"
    )
)

REM コアディレクトリの処理
echo.
echo [4/4] コアディレクトリを移行します...
if exist "%~dp0core\package.json" (
    echo 移行: core
    call :migrate_project "%~dp0core"
)

echo.
echo 全てのプロジェクトの移行が完了しました！
echo.
echo 次のステップ:
echo 1. Claude Desktop設定ファイルの'npx'コマンドを'pnpm dlx'に置き換えてください
echo 2. 'npm run'コマンドを'pnpm'に置き換えてください

echo.
echo スクリプトが完了しました！
pause
exit /b 0

:migrate_project
set "PROJECT_DIR=%~1"
cd "%PROJECT_DIR%"
echo 現在のディレクトリ: %cd%

REM package.jsonのバックアップを作成
if exist "package.json" (
    copy "package.json" "%BACKUP_DIR%\%~nx1_package.json.backup" >nul
    
    REM node_modulesを削除
    if exist "node_modules" (
        echo - node_modulesを削除しています...
        rmdir /s /q "node_modules"
    )
    
    REM package-lock.jsonを削除
    if exist "package-lock.json" (
        echo - package-lock.jsonを削除しています...
        copy "package-lock.json" "%BACKUP_DIR%\%~nx1_package-lock.json.backup" >nul
        del "package-lock.json"
    )
    
    REM pnpmを使用してパッケージをインストール
    echo - パッケージをpnpmでインストールしています...
    call pnpm install
    
    echo - %~nx1の移行が完了しました
) else (
    echo - package.jsonが見つかりません。移行をスキップします。
)

cd "%~dp0"
exit /b
