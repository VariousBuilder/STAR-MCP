# STAR-MCP: サーバー状態チェックスクリプト(PowerShell版)
Write-Host "STAR-MCP: サーバー状態チェックスクリプト" -ForegroundColor Green
Write-Host "-----------------------------------------" -ForegroundColor Green

# Claude Desktop設定ファイルのパス
$CONFIG_FILE = "$env:APPDATA\Claude\claude_desktop_config.json"

# ログファイル一覧
$LOG_DIR = "$env:APPDATA\Claude\logs"

# STAR-MCPのルートディレクトリ
$STAR_MCP_ROOT = "C:\Users\tomoy\Dropbox\01_Dev\STAR-MCP"

# 確認項目
Write-Host "1. MCPサーバー設定の確認" -ForegroundColor Yellow
if (Test-Path $CONFIG_FILE) {
    Write-Host "  ✓ Claude Desktop設定ファイルが存在します" -ForegroundColor Green
    
    try {
        # JSONファイルの読み込み
        $config = Get-Content $CONFIG_FILE -Raw | ConvertFrom-Json
        
        Write-Host "  設定されているサーバー:"
        foreach ($server in $config.mcpServers.PSObject.Properties.Name) {
            Write-Host "    - $server" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ✗ 設定ファイルの解析に失敗しました: $_" -ForegroundColor Red
    }
} else {
    Write-Host "  ✗ Claude Desktop設定ファイルが見つかりません" -ForegroundColor Red
}

Write-Host ""
Write-Host "2. MCP サーバーログの確認" -ForegroundColor Yellow
if (Test-Path $LOG_DIR) {
    Write-Host "  ✓ ログディレクトリが存在します" -ForegroundColor Green
    
    # ログファイルの一覧を取得
    Write-Host "  最近のログファイル:"
    $logFiles = Get-ChildItem "$LOG_DIR\mcp*.log" | Sort-Object LastWriteTime -Descending | Select-Object -First 5
    
    if ($logFiles.Count -gt 0) {
        foreach ($log in $logFiles) {
            $sizeKB = [math]::Round($log.Length / 1KB, 2)
            Write-Host "    - $($log.Name) ($sizeKB KB)" -ForegroundColor Cyan
        }
        
        # エラーの検出
        Write-Host ""
        Write-Host "  エラーチェック:"
        $errorCount = 0
        foreach ($log in $logFiles) {
            $content = Get-Content $log.FullName -Raw
            if ($content -match 'error|exception|failed|failure' -and $content -notmatch 'handling error|recover from error') {
                $errorCount++
                Write-Host "    ✗ $($log.Name) にエラーが検出されました" -ForegroundColor Red
            }
        }
        
        if ($errorCount -eq 0) {
            Write-Host "    ✓ 明確なエラーは検出されませんでした" -ForegroundColor Green
        }
    } else {
        Write-Host "    ✗ ログファイルが見つかりません" -ForegroundColor Red
    }
} else {
    Write-Host "  ✗ ログディレクトリが見つかりません" -ForegroundColor Red
}

Write-Host ""
Write-Host "3. サーバー実装状態の確認" -ForegroundColor Yellow
if (Test-Path "$STAR_MCP_ROOT\servers") {
    Write-Host "  ✓ サーバーディレクトリが存在します" -ForegroundColor Green
    
    Write-Host "  実装されているサーバー:"
    $serverDirs = Get-ChildItem "$STAR_MCP_ROOT\servers" -Directory
    foreach ($dir in $serverDirs) {
        Write-Host "    - $($dir.Name)" -ForegroundColor Green
    }
} else {
    Write-Host "  ✗ サーバーディレクトリが見つかりません" -ForegroundColor Red
}

Write-Host ""
Write-Host "4. 依存関係の確認" -ForegroundColor Yellow
if (Test-Path "$STAR_MCP_ROOT\package.json") {
    Write-Host "  ✓ package.jsonが存在します" -ForegroundColor Green
    
    try {
        # package.jsonの読み込み
        $pkg = Get-Content "$STAR_MCP_ROOT\package.json" -Raw | ConvertFrom-Json
        
        Write-Host "  主要な依存関係:"
        if ($pkg.dependencies) {
            $deps = $pkg.dependencies.PSObject.Properties.Name
            foreach ($dep in $deps) {
                Write-Host "    - $dep" -ForegroundColor Cyan
            }
        } else {
            Write-Host "    ✗ 依存関係が定義されていません" -ForegroundColor Red
        }
    } catch {
        Write-Host "    ✗ package.jsonの解析に失敗しました: $_" -ForegroundColor Red
    }
    
    # npm vs pnpm の確認
    if (Test-Path "$STAR_MCP_ROOT\pnpm-lock.yaml") {
        Write-Host "  ✓ pnpmが使用されています" -ForegroundColor Green
    } elseif (Test-Path "$STAR_MCP_ROOT\package-lock.json") {
        Write-Host "  ➤ npmが使用されています（pnpmへの移行を推奨）" -ForegroundColor Yellow
    } else {
        Write-Host "  ✗ ロックファイルが見つかりません" -ForegroundColor Red
    }
} else {
    Write-Host "  ✗ package.jsonが見つかりません" -ForegroundColor Red
}

Write-Host ""
Write-Host "確認が完了しました！" -ForegroundColor Green
Write-Host "問題がある場合は、上記の出力を確認して対応してください。"

# PowerShellスクリプトの終了時にウィンドウを閉じないようにする
Write-Host ""
Write-Host "Enterキーを押して終了..."
$null = Read-Host
