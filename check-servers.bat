@echo off
echo STAR-MCP: サーバー状態チェックスクリプト
echo -----------------------------------------

REM 色の設定
set "GREEN=[92m"
set "YELLOW=[93m"
set "RED=[91m"
set "RESET=[0m"

echo %GREEN%サーバー構成の確認を開始します...%RESET%
echo.

REM Claude Desktop設定ファイルのパス
set "CONFIG_FILE=%APPDATA%\Claude\claude_desktop_config.json"

REM ログファイル一覧
set "LOG_DIR=%APPDATA%\Claude\logs"

REM 確認項目
echo %YELLOW%1. MCPサーバー設定の確認%RESET%
if exist "%CONFIG_FILE%" (
    echo   %GREEN%✓ Claude Desktop設定ファイルが存在します%RESET%
    
    REM PowerShellを使って設定ファイルからサーバー一覧を抽出
    powershell -Command "Get-Content '%CONFIG_FILE%' | Select-String '\"([a-zA-Z0-9-]+)\"\\s*:\\s*{' -AllMatches | ForEach-Object { $_.Matches } | ForEach-Object { $_.Groups[1].Value } | Where-Object { $_ -ne 'mcpServers' -and $_ -ne 'command' -and $_ -ne 'args' -and $_ -ne 'env' } | Sort-Object | Get-Unique" > "%TEMP%\mcp_servers.txt"
    
    echo   設定されているサーバー:
    for /f "usebackq delims=" %%s in ("%TEMP%\mcp_servers.txt") do (
        echo     %GREEN%- %%s%RESET%
    )
    
) else (
    echo   %RED%✗ Claude Desktop設定ファイルが見つかりません%RESET%
)

echo.
echo %YELLOW%2. MCP サーバーログの確認%RESET%
if exist "%LOG_DIR%" (
    echo   %GREEN%✓ ログディレクトリが存在します%RESET%
    
    REM ログファイルの一覧を取得
    echo   最近のログファイル:
    powershell -Command "Get-ChildItem '%LOG_DIR%\mcp*.log' | Sort-Object LastWriteTime -Descending | Select-Object -First 5 | ForEach-Object { '    ' + $_.Name + ' (' + $_.LastWriteTime + ') - ' + [math]::Round($_.Length / 1KB, 2) + ' KB' }"
    
    REM エラーの検出
    echo.
    echo   エラーチェック:
    powershell -Command "$errorCount = 0; Get-ChildItem '%LOG_DIR%\mcp*.log' | ForEach-Object { $content = Get-Content $_.FullName -Raw; if ($content -match 'error|exception|failed|failure' -and $content -notmatch 'handling error|recover from error') { $errorCount++; Write-Host '    [91m✗ ' + $_.Name + ' にエラーが検出されました[0m' } }; if ($errorCount -eq 0) { Write-Host '    [92m✓ 明確なエラーは検出されませんでした[0m' }"
    
) else (
    echo   %RED%✗ ログディレクトリが見つかりません%RESET%
)

echo.
echo %YELLOW%3. サーバー実装状態の確認%RESET%
set "STAR_MCP_ROOT=C:\Users\tomoy\Dropbox\01_Dev\STAR-MCP"

REM サーバーディレクトリの確認
if exist "%STAR_MCP_ROOT%\servers" (
    echo   %GREEN%✓ サーバーディレクトリが存在します%RESET%
    
    echo   実装されているサーバー:
    for /d %%d in ("%STAR_MCP_ROOT%\servers\*") do (
        for %%f in (%%d\*.js %%d\*.ts %%d\*.py) do (
            echo     %GREEN%- %%~nd%RESET%
            goto :found_server_%%~nd
        )
        :found_server_%%~nd
    )
    
) else (
    echo   %RED%✗ サーバーディレクトリが見つかりません%RESET%
)

echo.
echo %YELLOW%4. 依存関係の確認%RESET%
if exist "%STAR_MCP_ROOT%\package.json" (
    echo   %GREEN%✓ package.jsonが存在します%RESET%
    
    REM 主要な依存関係を表示
    echo   主要な依存関係:
    powershell -Command "try { $pkg = Get-Content '%STAR_MCP_ROOT%\package.json' | ConvertFrom-Json; $deps = @($pkg.dependencies.PSObject.Properties | ForEach-Object { $_.Name }); if ($deps.Count -gt 0) { $deps | ForEach-Object { Write-Host '    - ' + $_ } } else { Write-Host '    [91m✗ 依存関係が定義されていません[0m' } } catch { Write-Host '    [91m✗ package.jsonの解析に失敗しました[0m' }"
    
    REM npm vs pnpm の確認
    if exist "%STAR_MCP_ROOT%\pnpm-lock.yaml" (
        echo   %GREEN%✓ pnpmが使用されています%RESET%
    ) elseif exist "%STAR_MCP_ROOT%\package-lock.json" (
        echo   %YELLOW%➤ npmが使用されています（pnpmへの移行を推奨）%RESET%
    ) else (
        echo   %RED%✗ ロックファイルが見つかりません%RESET%
    )
    
) else (
    echo   %RED%✗ package.jsonが見つかりません%RESET%
)

echo.
echo %GREEN%確認が完了しました！%RESET%
echo 問題がある場合は、上記の出力を確認して対応してください。
echo.
pause
