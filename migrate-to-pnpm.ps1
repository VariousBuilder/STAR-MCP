# STAR-MCP: npm/npx から pnpm への移行スクリプト(PowerShell版)
Write-Host "STAR-MCP: npm/npx から pnpm への移行スクリプト" -ForegroundColor Green
Write-Host "--------------------------------------------" -ForegroundColor Green

# プロジェクトルートを取得
$PROJECT_ROOT = Get-Location

# pnpmがインストールされているか確認
$pnpmInstalled = $null
try {
    $pnpmInstalled = Get-Command pnpm -ErrorAction Stop
    Write-Host "✓ pnpmがインストールされています" -ForegroundColor Green
} catch {
    Write-Host "pnpmがインストールされていません。インストールします..." -ForegroundColor Yellow
    try {
        npm install -g pnpm
        Write-Host "✓ pnpmがインストールされました" -ForegroundColor Green
    } catch {
        Write-Host "✗ pnpmのインストールに失敗しました: $_" -ForegroundColor Red
        exit 1
    }
}

Write-Host "プロジェクトルート: $PROJECT_ROOT" -ForegroundColor Cyan

# package.jsonが存在するか確認
if (-not (Test-Path "$PROJECT_ROOT\package.json")) {
    Write-Host "✗ package.jsonが見つかりません" -ForegroundColor Red
    exit 1
}

# package.jsonのバックアップを作成
Write-Host "package.jsonのバックアップを作成しています..." -ForegroundColor Yellow
try {
    Copy-Item "$PROJECT_ROOT\package.json" "$PROJECT_ROOT\package.json.backup"
    Write-Host "✓ バックアップが作成されました: package.json.backup" -ForegroundColor Green
} catch {
    Write-Host "✗ バックアップの作成に失敗しました: $_" -ForegroundColor Red
    exit 1
}

# node_modulesが存在する場合は削除
if (Test-Path "$PROJECT_ROOT\node_modules") {
    Write-Host "既存のnode_modulesを削除しています..." -ForegroundColor Yellow
    try {
        Remove-Item "$PROJECT_ROOT\node_modules" -Recurse -Force
        Write-Host "✓ node_modulesが削除されました" -ForegroundColor Green
    } catch {
        Write-Host "✗ node_modulesの削除に失敗しました: $_" -ForegroundColor Red
        exit 1
    }
}

# package-lock.jsonが存在する場合は削除
if (Test-Path "$PROJECT_ROOT\package-lock.json") {
    Write-Host "package-lock.jsonを削除しています..." -ForegroundColor Yellow
    try {
        Remove-Item "$PROJECT_ROOT\package-lock.json"
        Write-Host "✓ package-lock.jsonが削除されました" -ForegroundColor Green
    } catch {
        Write-Host "✗ package-lock.jsonの削除に失敗しました: $_" -ForegroundColor Red
    }
}

# pnpmを使用してパッケージをインストール
Write-Host "pnpmを使用してパッケージをインストールしています..." -ForegroundColor Yellow
try {
    & pnpm install
    Write-Host "✓ パッケージのインストールが完了しました" -ForegroundColor Green
} catch {
    Write-Host "✗ パッケージのインストールに失敗しました: $_" -ForegroundColor Red
    exit 1
}

# package.jsonのscriptsセクションを更新
Write-Host "package.jsonを更新しています..." -ForegroundColor Yellow
try {
    $packageJson = Get-Content "$PROJECT_ROOT\package.json" -Raw
    $packageJson = $packageJson -replace 'npm run', 'pnpm run'
    $packageJson = $packageJson -replace 'npm install', 'pnpm install'
    Set-Content -Path "$PROJECT_ROOT\package.json" -Value $packageJson
    Write-Host "✓ package.jsonの更新が完了しました" -ForegroundColor Green
} catch {
    Write-Host "✗ package.jsonの更新に失敗しました: $_" -ForegroundColor Red
}

# pnpm-lock.yamlが生成されたか確認
if (-not (Test-Path "$PROJECT_ROOT\pnpm-lock.yaml")) {
    Write-Host "警告: pnpm-lock.yamlが生成されませんでした" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "移行が完了しました。次にやるべきこと:" -ForegroundColor Green
Write-Host "1. Claude Desktop設定ファイル($env:APPDATA\Claude\claude_desktop_config.json)の'npx'コマンドを'pnpm dlx'に置き換える"
Write-Host "2. スクリプト内の'npm run'コマンドを'pnpm run'に置き換える"
Write-Host "3. その他のnpm/npx関連コマンドを適宜更新する"

# サブディレクトリの処理を確認
Write-Host ""
$processSubDirs = Read-Host "サブディレクトリの変換を行いますか？ (Y/N)"
if ($processSubDirs -eq 'Y' -or $processSubDirs -eq 'y') {
    Write-Host "サブディレクトリの変換を開始します..." -ForegroundColor Yellow
    
    # core ディレクトリの処理
    if (Test-Path "$PROJECT_ROOT\core\package.json") {
        Write-Host "core ディレクトリを処理しています..." -ForegroundColor Cyan
        Set-Location "$PROJECT_ROOT\core"
        if (Test-Path "node_modules") { Remove-Item "node_modules" -Recurse -Force }
        if (Test-Path "package-lock.json") { Remove-Item "package-lock.json" }
        Copy-Item "package.json" "package.json.backup"
        & pnpm install
        $packageJson = Get-Content "package.json" -Raw
        $packageJson = $packageJson -replace 'npm run', 'pnpm run'
        $packageJson = $packageJson -replace 'npm install', 'pnpm install'
        Set-Content -Path "package.json" -Value $packageJson
    }
    
    # servers ディレクトリの処理（サブディレクトリを反復）
    if (Test-Path "$PROJECT_ROOT\servers") {
        $serverDirs = Get-ChildItem "$PROJECT_ROOT\servers" -Directory
        foreach ($dir in $serverDirs) {
            if (Test-Path "$($dir.FullName)\package.json") {
                Write-Host "$($dir.Name) を処理しています..." -ForegroundColor Cyan
                Set-Location $dir.FullName
                if (Test-Path "node_modules") { Remove-Item "node_modules" -Recurse -Force }
                if (Test-Path "package-lock.json") { Remove-Item "package-lock.json" }
                Copy-Item "package.json" "package.json.backup"
                & pnpm install
                $packageJson = Get-Content "package.json" -Raw
                $packageJson = $packageJson -replace 'npm run', 'pnpm run'
                $packageJson = $packageJson -replace 'npm install', 'pnpm install'
                Set-Content -Path "package.json" -Value $packageJson
            }
        }
    }
    
    # agents ディレクトリの処理（サブディレクトリを反復）
    if (Test-Path "$PROJECT_ROOT\agents") {
        $agentDirs = Get-ChildItem "$PROJECT_ROOT\agents" -Directory
        foreach ($dir in $agentDirs) {
            if (Test-Path "$($dir.FullName)\package.json") {
                Write-Host "$($dir.Name) を処理しています..." -ForegroundColor Cyan
                Set-Location $dir.FullName
                if (Test-Path "node_modules") { Remove-Item "node_modules" -Recurse -Force }
                if (Test-Path "package-lock.json") { Remove-Item "package-lock.json" }
                Copy-Item "package.json" "package.json.backup"
                & pnpm install
                $packageJson = Get-Content "package.json" -Raw
                $packageJson = $packageJson -replace 'npm run', 'pnpm run'
                $packageJson = $packageJson -replace 'npm install', 'pnpm install'
                Set-Content -Path "package.json" -Value $packageJson
            }
        }
    }
    
    Write-Host "サブディレクトリの変換が完了しました" -ForegroundColor Green
}

# プロジェクトルートに戻る
Set-Location $PROJECT_ROOT

Write-Host ""
Write-Host "移行プロセスが完了しました！" -ForegroundColor Green
Write-Host ""
Write-Host "Enterキーを押して終了..."
$null = Read-Host
