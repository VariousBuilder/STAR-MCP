@echo off
echo STAR-MCP: npm/npx から pnpm への移行スクリプト
echo --------------------------------------------

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

REM インストール中のプロジェクトパスを保存
set "PROJECT_ROOT=%cd%"
echo プロジェクトルート: %PROJECT_ROOT%

REM package.jsonが存在するか確認
if not exist "%PROJECT_ROOT%\package.json" (
    echo package.jsonが見つかりません。
    exit /b 1
)

REM package.jsonのバックアップを作成
echo package.jsonのバックアップを作成しています...
copy "%PROJECT_ROOT%\package.json" "%PROJECT_ROOT%\package.json.backup"
if %errorlevel% neq 0 (
    echo バックアップの作成に失敗しました。
    exit /b 1
)
echo バックアップが作成されました: package.json.backup

REM node_modulesが存在する場合は削除
if exist "%PROJECT_ROOT%\node_modules" (
    echo 既存のnode_modulesを削除しています...
    rmdir /s /q "%PROJECT_ROOT%\node_modules"
    if %errorlevel% neq 0 (
        echo node_modulesの削除に失敗しました。
        exit /b 1
    )
)

REM package-lock.jsonが存在する場合は削除
if exist "%PROJECT_ROOT%\package-lock.json" (
    echo package-lock.jsonを削除しています...
    del "%PROJECT_ROOT%\package-lock.json"
)

REM pnpmを使用してパッケージをインストール
echo pnpmを使用してパッケージをインストールしています...
call pnpm install
if %errorlevel% neq 0 (
    echo パッケージのインストールに失敗しました。
    exit /b 1
)

REM package.jsonのscriptsセクションを更新
echo package.jsonを更新しています...
powershell -Command "(Get-Content '%PROJECT_ROOT%\package.json') -replace 'npm run', 'pnpm run' | Set-Content '%PROJECT_ROOT%\package.json'"
powershell -Command "(Get-Content '%PROJECT_ROOT%\package.json') -replace 'npm install', 'pnpm install' | Set-Content '%PROJECT_ROOT%\package.json'"

REM pnpm-lock.yamlが生成されたか確認
if not exist "%PROJECT_ROOT%\pnpm-lock.yaml" (
    echo 警告: pnpm-lock.yamlが生成されませんでした。
)

echo 移行が完了しました。次にやるべきこと:
echo 1. scripts/batファイルの'npx'コマンドを'pnpm dlx'に置き換える
echo 2. 'npm run'コマンドを'pnpm run'に置き換える
echo 3. その他のnpm/npx関連コマンドを適宜更新する

REM サブディレクトリに対しても同様の処理を行う
echo.
echo サブディレクトリの変換を行いますか？ (Y/N)
choice /c YN /m "サブディレクトリも変換する"
if %errorlevel% equ 1 (
    echo サブディレクトリの変換を開始します...
    
    REM core ディレクトリの処理
    if exist "%PROJECT_ROOT%\core\package.json" (
        echo core ディレクトリを処理しています...
        cd "%PROJECT_ROOT%\core"
        if exist "node_modules" rmdir /s /q "node_modules"
        if exist "package-lock.json" del "package-lock.json"
        copy "package.json" "package.json.backup"
        call pnpm install
        powershell -Command "(Get-Content 'package.json') -replace 'npm run', 'pnpm run' | Set-Content 'package.json'"
        powershell -Command "(Get-Content 'package.json') -replace 'npm install', 'pnpm install' | Set-Content 'package.json'"
    )
    
    REM servers ディレクトリの処理（サブディレクトリを反復）
    if exist "%PROJECT_ROOT%\servers" (
        for /d %%d in ("%PROJECT_ROOT%\servers\*") do (
            if exist "%%d\package.json" (
                echo %%d を処理しています...
                cd "%%d"
                if exist "node_modules" rmdir /s /q "node_modules"
                if exist "package-lock.json" del "package-lock.json"
                copy "package.json" "package.json.backup"
                call pnpm install
                powershell -Command "(Get-Content 'package.json') -replace 'npm run', 'pnpm run' | Set-Content 'package.json'"
                powershell -Command "(Get-Content 'package.json') -replace 'npm install', 'pnpm install' | Set-Content 'package.json'"
            )
        )
    )
    
    REM agents ディレクトリの処理（サブディレクトリを反復）
    if exist "%PROJECT_ROOT%\agents" (
        for /d %%d in ("%PROJECT_ROOT%\agents\*") do (
            if exist "%%d\package.json" (
                echo %%d を処理しています...
                cd "%%d"
                if exist "node_modules" rmdir /s /q "node_modules"
                if exist "package-lock.json" del "package-lock.json"
                copy "package.json" "package.json.backup"
                call pnpm install
                powershell -Command "(Get-Content 'package.json') -replace 'npm run', 'pnpm run' | Set-Content 'package.json'"
                powershell -Command "(Get-Content 'package.json') -replace 'npm install', 'pnpm install' | Set-Content 'package.json'"
            )
        )
    )
    
    echo サブディレクトリの変換が完了しました。
)

REM プロジェクトルートに戻る
cd "%PROJECT_ROOT%"

REM Claude Desktop設定ファイルの更新を提案
echo.
echo Claude Desktop設定ファイルのnpx呼び出しをpnpm dlxに置き換えますか？ (Y/N)
choice /c YN /m "Claude Desktop設定を更新する"
if %errorlevel% equ 1 (
    echo Claude Desktop設定ファイルを更新する方法:
    echo 1. %APPDATA%\Claude\claude_desktop_config.jsonを開く
    echo 2. すべての"npx"を"pnpm dlx"に置き換える
    echo 3. 保存してClaudeを再起動する
    echo.
    echo この操作は手動で行う必要があります。
)

echo.
echo 移行プロセスが完了しました！
echo.
pause
