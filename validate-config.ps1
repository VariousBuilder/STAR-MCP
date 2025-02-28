# MCPサーバー設定の検証スクリプト
$configPath = "$env:APPDATA\Claude\claude_desktop_config.json"

if (Test-Path $configPath) {
    Write-Host "Claude Desktop設定ファイルが存在します" -ForegroundColor Green
    
    try {
        # 設定ファイルを読み込む
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        
        # 正常に読み込めたか確認
        if ($config -and $config.mcpServers) {
            Write-Host "設定ファイルが正常に読み込まれました" -ForegroundColor Green
            
            # サーバー一覧を表示
            $servers = $config.mcpServers.PSObject.Properties.Name
            Write-Host "設定されているサーバー:" -ForegroundColor Cyan
            foreach ($server in $servers) {
                Write-Host "- $server" -ForegroundColor Green
            }
            
            Write-Host "各サーバーの詳細:" -ForegroundColor Yellow
            foreach ($server in $servers) {
                Write-Host "`n$($server):" -ForegroundColor Cyan
                Write-Host "  コマンド: $($config.mcpServers.$server.command)"
                Write-Host "  引数: $($config.mcpServers.$server.args -join ', ')"
                
                if ($config.mcpServers.$server.env) {
                    Write-Host "  環境変数:"
                    foreach ($env in $config.mcpServers.$server.env.PSObject.Properties) {
                        Write-Host "    $($env.Name): $($env.Value)"
                    }
                }
            }
        } else {
            Write-Host "mcpServers設定が見つかりません" -ForegroundColor Red
        }
    } catch {
        Write-Host "設定ファイルの解析に失敗しました: $_" -ForegroundColor Red
    }
} else {
    Write-Host "Claude Desktop設定ファイルが見つかりません" -ForegroundColor Red
}

Write-Host "`nEnterキーを押して終了..." -ForegroundColor Gray
$null = Read-Host
