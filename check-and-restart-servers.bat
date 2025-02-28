@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion
echo STAR-MCP: サーバー状態確認と再起動スクリプト
echo ------------------------------------------------

REM 設定ファイルのパス
set "CONFIG_FILE=%APPDATA%\Claude\claude_desktop_config.json"

REM ログディレクトリ
set "LOG_DIR=%APPDATA%\Claude\logs"

if not exist "%CONFIG_FILE%" (
    echo エラー: Claude Desktop設定ファイルが見つかりません。
    exit /b 1
)

REM サーバー一覧の取得
echo サーバー設定を読み込んでいます...

REM PowerShellを使って設定ファイルからサーバー一覧を抽出
powershell -Command "$config = Get-Content '%CONFIG_FILE%' | ConvertFrom-Json; $servers = $config.mcpServers.PSObject.Properties.Name; $servers | ForEach-Object { $_ }" > "%TEMP%\mcp_servers_list.txt"

:menu
cls
echo.
echo STAR-MCP サーバー管理
echo ============================
echo.
echo 利用可能なMCPサーバー:
echo.

REM 各サーバーの状態を表示
set "INDEX=1"
for /f "usebackq delims=" %%s in ("%TEMP%\mcp_servers_list.txt") do (
    set "SERVER_NAME=%%s"
    set "SERVER_LOG_FILE=%LOG_DIR%\mcp-server-%%s.log"
    
    if exist "!SERVER_LOG_FILE!" (
        REM 最終更新時刻を取得
        for /f "tokens=*" %%t in ('powershell -Command "(Get-Item '!SERVER_LOG_FILE!').LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss')"') do (
            set "LAST_UPDATE=%%t"
        )
        
        REM ファイルサイズを取得
        for /f "tokens=*" %%z in ('powershell -Command "[math]::Round((Get-Item '!SERVER_LOG_FILE!').Length / 1KB, 1)"') do (
            set "FILE_SIZE=%%z"
        )
        
        REM エラーの確認
        powershell -Command "$content = Get-Content '!SERVER_LOG_FILE!' -Tail 20; $hasError = $content -match 'error|exception|failed|failure' -and $content -notmatch 'handling error|recover from error'; $hasError" > "%TEMP%\has_error.txt"
        set /p HAS_ERROR=<"%TEMP%\has_error.txt"
        
        if "!HAS_ERROR!"=="True" (
            echo   !INDEX!. [ERROR] !SERVER_NAME! (最終更新: !LAST_UPDATE!, サイズ: !FILE_SIZE! KB)
        ) else (
            echo   !INDEX!. [OK] !SERVER_NAME! (最終更新: !LAST_UPDATE!, サイズ: !FILE_SIZE! KB)
        )
    ) else (
        echo   !INDEX!. [未起動] !SERVER_NAME!
    )
    
    set /a "INDEX+=1"
)

echo.
echo オプション:
echo   r. すべてのサーバーを再起動
echo   c. Claude Desktopを再起動
echo   l. ログファイルの削除
echo   q. 終了
echo.
set /p CHOICE=選択してください (1-%INDEX%, r, c, l, q): 

if "%CHOICE%"=="q" exit /b 0
if "%CHOICE%"=="r" goto restart_all
if "%CHOICE%"=="c" goto restart_claude
if "%CHOICE%"=="l" goto clean_logs

REM 数値が入力された場合、対応するサーバーを選択
set "INDEX=1"
for /f "usebackq delims=" %%s in ("%TEMP%\mcp_servers_list.txt") do (
    if "%CHOICE%"=="%INDEX%" (
        set "SELECTED_SERVER=%%s"
        goto server_options
    )
    set /a "INDEX+=1"
)

echo 無効な選択です。
timeout /t 2 >nul
goto menu

:server_options
cls
echo.
echo %SELECTED_SERVER% サーバーの管理
echo ============================
echo.
echo 1. ログを表示
echo 2. サーバーを再起動
echo 3. 設定を表示
echo 4. エラーをチェック
echo 5. メインメニューに戻る
echo.
set /p SERVER_CHOICE=選択してください (1-5): 

if "%SERVER_CHOICE%"=="1" goto show_log
if "%SERVER_CHOICE%"=="2" goto restart_server
if "%SERVER_CHOICE%"=="3" goto show_config
if "%SERVER_CHOICE%"=="4" goto check_errors
if "%SERVER_CHOICE%"=="5" goto menu

echo 無効な選択です。
timeout /t 2 >nul
goto server_options

:show_log
cls
echo.
echo %SELECTED_SERVER% の最新ログ:
echo ============================
echo.
powershell -Command "Get-Content '%LOG_DIR%\mcp-server-%SELECTED_SERVER%.log' -Tail 50"
echo.
echo Enter キーでメニューに戻ります...
pause >nul
goto server_options

:restart_server
echo.
echo %SELECTED_SERVER% サーバーを再起動します...
echo.

REM Claude Desktopを停止
taskkill /f /im "Claude.exe" >nul 2>&1

REM ログファイルを削除（新しいログを取得するため）
if exist "%LOG_DIR%\mcp-server-%SELECTED_SERVER%.log" del "%LOG_DIR%\mcp-server-%SELECTED_SERVER%.log"

REM Claude Desktopを再起動
start "" "%APPDATA%\..\Local\Programs\Claude\Claude.exe"

echo.
echo %SELECTED_SERVER% サーバーを再起動しました。
echo Claude Desktopが再起動されるまでお待ちください...
echo.
echo Enter キーでメインメニューに戻ります...
pause >nul
goto menu

:show_config
cls
echo.
echo %SELECTED_SERVER% の設定:
echo ============================
echo.
powershell -Command "$config = Get-Content '%CONFIG_FILE%' | ConvertFrom-Json; $serverConfig = $config.mcpServers.'%SELECTED_SERVER%' | ConvertTo-Json -Depth 5; $serverConfig"
echo.
echo Enter キーでメニューに戻ります...
pause >nul
goto server_options

:check_errors
cls
echo.
echo %SELECTED_SERVER% のエラーチェック:
echo ============================
echo.
powershell -Command "$log = Get-Content '%LOG_DIR%\mcp-server-%SELECTED_SERVER%.log' -ErrorAction SilentlyContinue; if ($log) { $errors = $log | Select-String -Pattern 'error|exception|failed|failure' | Where-Object { $_ -notmatch 'handling error|recover from error' }; if ($errors) { $errors } else { Write-Host 'エラーは見つかりませんでした。' } } else { Write-Host 'ログファイルが見つかりません。' }"
echo.
echo Enter キーでメニューに戻ります...
pause >nul
goto server_options

:restart_all
echo.
echo すべてのサーバーを再起動します...
echo.

REM Claude Desktopを停止
taskkill /f /im "Claude.exe" >nul 2>&1

REM ログファイルを削除（新しいログを取得するため）
for /f "usebackq delims=" %%s in ("%TEMP%\mcp_servers_list.txt") do (
    if exist "%LOG_DIR%\mcp-server-%%s.log" del "%LOG_DIR%\mcp-server-%%s.log"
)

REM Claude Desktopを再起動
start "" "%APPDATA%\..\Local\Programs\Claude\Claude.exe"

echo.
echo すべてのサーバーを再起動しました。
echo Claude Desktopが再起動されるまでお待ちください...
echo.
echo Enter キーでメインメニューに戻ります...
pause >nul
goto menu

:restart_claude
echo.
echo Claude Desktopを再起動します...
echo.

REM Claude Desktopを停止
taskkill /f /im "Claude.exe" >nul 2>&1

REM Claude Desktopを再起動
start "" "%APPDATA%\..\Local\Programs\Claude\Claude.exe"

echo.
echo Claude Desktopを再起動しました。
echo.
echo Enter キーでメインメニューに戻ります...
pause >nul
goto menu

:clean_logs
cls
echo.
echo ログファイル管理
echo ============================
echo.
echo 1. すべてのログファイルを削除
echo 2. 古いログファイルをアーカイブ（old ディレクトリに移動）
echo 3. ログファイル一覧を表示
echo 4. メインメニューに戻る
echo.
set /p LOG_CHOICE=選択してください (1-4): 

if "%LOG_CHOICE%"=="1" goto delete_logs
if "%LOG_CHOICE%"=="2" goto archive_logs
if "%LOG_CHOICE%"=="3" goto list_logs
if "%LOG_CHOICE%"=="4" goto menu

echo 無効な選択です。
timeout /t 2 >nul
goto clean_logs

:delete_logs
echo.
echo ログファイルを削除しています...

REM Claude Desktopを停止
taskkill /f /im "Claude.exe" >nul 2>&1

REM ログファイルを削除
del "%LOG_DIR%\mcp-*.log" >nul 2>&1

echo ログファイルを削除しました。

REM Claude Desktopを再起動
start "" "%APPDATA%\..\Local\Programs\Claude\Claude.exe"

echo Claude Desktopを再起動しました。
echo.
echo Enter キーでメインメニューに戻ります...
pause >nul
goto menu

:archive_logs
echo.
echo ログファイルをアーカイブしています...

REM oldディレクトリを作成
if not exist "%LOG_DIR%\old" mkdir "%LOG_DIR%\old"

REM 現在の日時を取得
for /f "tokens=*" %%d in ('powershell -Command "Get-Date -Format 'yyyyMMdd_HHmmss'"') do (
    set "DATE_STAMP=%%d"
)

REM Claude Desktopを停止
taskkill /f /im "Claude.exe" >nul 2>&1

REM ログファイルを移動
for %%f in ("%LOG_DIR%\mcp-*.log") do (
    move "%%f" "%LOG_DIR%\old\%%~nxf.%DATE_STAMP%" >nul
)

echo ログファイルをアーカイブしました。

REM Claude Desktopを再起動
start "" "%APPDATA%\..\Local\Programs\Claude\Claude.exe"

echo Claude Desktopを再起動しました。
echo.
echo Enter キーでメインメニューに戻ります...
pause >nul
goto menu

:list_logs
cls
echo.
echo ログファイル一覧:
echo ============================
echo.
powershell -Command "Get-ChildItem '%LOG_DIR%\mcp-*.log' | Sort-Object Length -Descending | Format-Table Name, @{Name='Size (KB)';Expression={[math]::Round($_.Length / 1KB, 1)}}, LastWriteTime -AutoSize"
echo.
echo Enter キーでメニューに戻ります...
pause >nul
goto clean_logs
