# 引き継ぎ情報の読み込みスクリプト

# 引き継ぎファイルのパス
$handoverPath = "C:\Users\tomoy\Dropbox\01_Dev\STAR-MCP\latest_handover.json"

# ファイルが存在するか確認
if (-not (Test-Path $handoverPath)) {
    Write-Host "引き継ぎファイルが見つかりません: $handoverPath"
    exit 1
}

# 引き継ぎ情報の読み込みと表示
$handoverJson = Get-Content -Path $handoverPath -Raw
$handover = $handoverJson | ConvertFrom-Json

# 時間を見やすい形式に変換
$timestamp = [DateTime]::Parse($handover.timestamp)
$formattedTime = $timestamp.ToString("yyyy-MM-dd HH:mm:ss")

Write-Host "===== STAR-MCPプロジェクト引き継ぎ情報 ====="
Write-Host "最終更新: $formattedTime"
Write-Host "トピック: $($handover.topic)"
Write-Host ""

Write-Host "== 現在の状況 =="
Write-Host $handover.current_context
Write-Host ""

Write-Host "== 進捗状況 =="
Write-Host "完了タスク:"
foreach ($task in $handover.status.completed) {
    Write-Host "  ✓ $task"
}
Write-Host "進行中タスク:"
foreach ($task in $handover.status.in_progress) {
    Write-Host "  → $task"
}
Write-Host "次のタスク:"
foreach ($task in $handover.status.next) {
    Write-Host "  ⋅ $task"
}
Write-Host ""

Write-Host "== コード進捗 =="
Write-Host $handover.code_progress
Write-Host ""

if ($handover.errors.Count -gt 0) {
    Write-Host "== エラー状況 =="
    foreach ($error in $handover.errors) {
        Write-Host "  ! $($error.type): $($error.status)"
        Write-Host "    $($error.details)"
    }
    Write-Host ""
}

Write-Host "== リソース =="
foreach ($resource in $handover.resources) {
    Write-Host "  - $resource"
}

# 完全なJSONデータを返す（必要に応じて）
return $handover
