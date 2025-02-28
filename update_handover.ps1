# 引き継ぎ情報の更新スクリプト
param(
    [string]$Topic = "STAR-MCP",
    [string]$CurrentContext = "",
    [string]$CodeProgress = "",
    [array]$Completed = @(),
    [array]$InProgress = @(),
    [array]$Next = @(),
    [array]$Errors = @(),
    [array]$Resources = @()
)

# 既存の引き継ぎファイルの読み込み
$handoverPath = "C:\Users\tomoy\Dropbox\01_Dev\STAR-MCP\latest_handover.json"
$existingData = @{}

if (Test-Path $handoverPath) {
    $existingJson = Get-Content -Path $handoverPath -Raw
    $existingData = $existingJson | ConvertFrom-Json -AsHashtable
}

# 既存データと新しいデータのマージ
$status = @{
    completed = if ($Completed.Count -gt 0) { $Completed } else { $existingData.status.completed }
    in_progress = if ($InProgress.Count -gt 0) { $InProgress } else { $existingData.status.in_progress }
    next = if ($Next.Count -gt 0) { $Next } else { $existingData.status.next }
}

$handoverInfo = @{
    timestamp = (Get-Date).ToString("o")
    topic = $Topic
    status = $status
    current_context = if ($CurrentContext) { $CurrentContext } else { $existingData.current_context }
    code_progress = if ($CodeProgress) { $CodeProgress } else { $existingData.code_progress }
    errors = if ($Errors.Count -gt 0) { $Errors } else { $existingData.errors }
    resources = if ($Resources.Count -gt 0) { $Resources } else { $existingData.resources }
}

# JSONに変換して保存
$handoverJson = $handoverInfo | ConvertTo-Json -Depth 5
Set-Content -Path $handoverPath -Value $handoverJson

Write-Host "引き継ぎ情報を更新しました: $handoverPath"
