# STAR-MCP: Claude Desktop設定最適化スクリプト
# ユーザー名の自動検出
$username = $env:USERNAME
$configPath = "$env:APPDATA\Claude\claude_desktop_config.json"
$backupPath = "$env:APPDATA\Claude\claude_desktop_config.json.bak"

# バックアップを作成
if (Test-Path $configPath) {
    Write-Host "設定ファイルのバックアップを作成しています..." -ForegroundColor Cyan
    Copy-Item -Path $configPath -Destination $backupPath -Force
    Write-Host "バックアップ作成: $backupPath" -ForegroundColor Green
}
else {
    Write-Host "Claude Desktop設定ファイルが見つかりません: $configPath" -ForegroundColor Red
    exit 1
}

# 設定ファイルを読み込む
try {
    $config = Get-Content $configPath -Raw | ConvertFrom-Json
    Write-Host "設定ファイルを読み込みました" -ForegroundColor Green
}
catch {
    Write-Host "設定ファイルの読み込みエラー: $_" -ForegroundColor Red
    exit 1
}

# 設定の最適化
Write-Host "`n設定の最適化を開始します..." -ForegroundColor Cyan

# 共通パスの変数
$dropboxDevPath = "C:\Users\$username\Dropbox\01_Dev"
$starMcpPath = "$dropboxDevPath\STAR-MCP"
$sharedMcpData = "$starMcpPath\shared"
$obsidianVaultPath = "C:\Users\$username\Google_OddAI\マイドライブ\02_生活\Obsidian_Vault"
$appDataPath = "C:\Users\$username\AppData\Roaming"

# npxからpnpmへの変換対象サーバーの一覧
$npxServers = @("filesystem", "brave-search", "obsidian")

# 各サーバーの設定を最適化
$servers = $config.mcpServers.PSObject.Properties.Name

foreach ($server in $servers) {
    Write-Host "`n$server サーバーの設定を最適化中..." -ForegroundColor Yellow
    
    # コマンド設定の取得
    $command = $config.mcpServers.$server.command
    
    # npxからpnpmへの変換
    if ($npxServers -contains $server -and $command -eq "npx") {
        Write-Host "  - npxからpnpmへ変換します" -ForegroundColor Cyan
        $config.mcpServers.$server.command = "pnpm"
        
        # 引数の先頭に'dlx'を追加
        $args = $config.mcpServers.$server.args
        if ($args[0] -ne "dlx") {
            $newArgs = @("dlx") + $args
            $config.mcpServers.$server.args = $newArgs
        }
    }
    
    # 環境変数の標準化
    if ($null -ne $config.mcpServers.$server.env) {
        Write-Host "  - 環境変数を標準化します" -ForegroundColor Cyan
        
        # SHARED_MCP_DATAの更新
        if ($null -ne $config.mcpServers.$server.env.SHARED_MCP_DATA) {
            $config.mcpServers.$server.env.SHARED_MCP_DATA = $sharedMcpData
        }
        
        # OBSIDIAN_VAULT_PATHの更新
        if ($null -ne $config.mcpServers.$server.env.OBSIDIAN_VAULT_PATH) {
            $config.mcpServers.$server.env.OBSIDIAN_VAULT_PATH = $obsidianVaultPath
        }
        
        # APPDATAパスの更新
        if ($null -ne $config.mcpServers.$server.env.APPDATA) {
            $config.mcpServers.$server.env.APPDATA = $appDataPath
        }
    }
    
    # サーバー固有の最適化
    switch ($server) {
        "enhanced-filesystem" {
            Write-Host "  - enhanced-filesystemをビルド済みバージョンに変更します" -ForegroundColor Cyan
            $config.mcpServers.$server.command = "node"
            $config.mcpServers.$server.args = @(
                "$starMcpPath\servers\enhanced-filesystem\build\index.js",
                "C:\Users\$username"
            )
        }
        
        "notion" {
            Write-Host "  - Notionサーバーの設定を確認します" -ForegroundColor Cyan
            if ($config.mcpServers.$server.env.NOTION_API_KEY -eq "YOUR_NOTION_API_KEY") {
                Write-Host "    ⚠️ Notion API Keyが設定されていません" -ForegroundColor Red
                Write-Host "    Notion APIキーを入力してください（何も入力せずEnterでスキップ）:"
                $notionKey = Read-Host
                if ($notionKey) {
                    $config.mcpServers.$server.env.NOTION_API_KEY = $notionKey
                    Write-Host "    ✓ Notion APIキーを設定しました" -ForegroundColor Green
                }
            }
        }
    }
}

# 変更を保存
try {
    $configJson = $config | ConvertTo-Json -Depth 10
    Set-Content -Path $configPath -Value $configJson -Encoding UTF8
    Write-Host "`n設定の最適化が完了しました！" -ForegroundColor Green
    Write-Host "ファイルを保存しました: $configPath" -ForegroundColor Green
}
catch {
    Write-Host "設定ファイルの保存エラー: $_" -ForegroundColor Red
    Write-Host "バックアップから復元できます: $backupPath" -ForegroundColor Yellow
    exit 1
}

# 後のステップを表示
Write-Host "`n次のステップ:" -ForegroundColor Cyan
Write-Host "1. Claude Desktopを再起動して変更を適用してください" -ForegroundColor White
Write-Host "2. enhanced-filesystemサーバーのビルドスクリプトを実行してください" -ForegroundColor White

Write-Host "`nEnterキーを押して終了..." -ForegroundColor Gray
$null = Read-Host
