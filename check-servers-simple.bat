@echo off
chcp 65001 > nul
echo STAR-MCP: サーバー状態チェックスクリプト(シンプル版)
echo -----------------------------------------

REM Claude Desktop設定ファイルのパス
set "CONFIG_FILE=%APPDATA%\Claude\claude_desktop_config.json"

REM ログファイル一覧
set "LOG_DIR=%APPDATA%\Claude\logs"

echo 1. MCPサーバー設定の確認
if exist "%CONFIG_FILE%" (
    echo - Claude Desktop設定ファイルが存在します
    
    REM PowerShellを使って設定ファイルからサーバー一覧を抽出
    powershell -Command "$json = Get-Content '%CONFIG_FILE%' | ConvertFrom-Json; $servers = $json.mcpServers.PSObject.Properties.Name; Write-Host '  設定されているサーバー:'; $servers | ForEach-Object { Write-Host ('  - ' + $_) }"
    
) else (
    echo - Claude Desktop設定ファイルが見つかりません
)

echo.
echo 2. MCP サーバーログの確認
if exist "%LOG_DIR%" (
    echo - ログディレクトリが存在します
    
    REM ログファイルの一覧を取得
    echo   最近のログファイル:
    powershell -Command "Get-ChildItem '%LOG_DIR%\mcp*.log' | Sort-Object LastWriteTime -Descending | Select-Object -First 5 | ForEach-Object { '  - ' + $_.Name + ' (' + [math]::Round($_.Length / 1KB, 2) + ' KB)' }"
    
) else (
    echo - ログディレクトリが見つかりません
)

echo.
echo 3. サーバー実装状態の確認
set "STAR_MCP_ROOT=C:\Users\tomoy\Dropbox\01_Dev\STAR-MCP"

REM サーバーディレクトリの確認
if exist "%STAR_MCP_ROOT%\servers" (
    echo - サーバーディレクトリが存在します
    powershell -Command "Get-ChildItem '%STAR_MCP_ROOT%\servers' -Directory | ForEach-Object { Write-Host ('  - ' + $_.Name) }"
) else (
    echo - サーバーディレクトリが見つかりません
)

echo.
echo 4. 依存関係の確認
if exist "%STAR_MCP_ROOT%\package.json" (
    echo - package.jsonが存在します
    
    REM パッケージマネージャーの確認
    if exist "%STAR_MCP_ROOT%\pnpm-lock.yaml" (
        echo - pnpmが使用されています
    ) elseif exist "%STAR_MCP_ROOT%\package-lock.json" (
        echo - npmが使用されています（pnpmへの移行を推奨）
    ) else (
        echo - ロックファイルが見つかりません
    )
    
) else (
    echo - package.jsonが見つかりません
)

echo.
echo 確認が完了しました！
pause
