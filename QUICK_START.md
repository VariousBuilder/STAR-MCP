# STAR-MCP クイックスタートガイド

このガイドでは、STAR-MCPプロジェクトのセットアップと実行に必要な基本的な手順を説明します。

## 1. 設定の確認

まず、Claude Desktopの設定を確認しましょう：

```powershell
# コマンドプロンプトまたはPowerShellから実行
cd C:\Users\tomoy\Dropbox\01_Dev\STAR-MCP
.\simple-validate.bat
```

このスクリプトは、Claude Desktop設定ファイルが存在するか、JSONが有効か、どのサーバーが設定されているかを確認します。

## 2. ログの確認

次に、サーバーログを確認しましょう：

```powershell
# コマンドプロンプトまたはPowerShellから実行
cd C:\Users\tomoy\Dropbox\01_Dev\STAR-MCP
.\quick-check.bat
```

このスクリプトは、ログディレクトリが存在するか、最近のログファイルのサイズと更新日時を表示します。

## 3. 設定のバックアップ

作業を始める前に、現在の設定をバックアップしましょう：

```powershell
# コマンドプロンプトまたはPowerShellから実行
cd C:\Users\tomoy\Dropbox\01_Dev\STAR-MCP
.\backup-config.bat
```

このスクリプトは、`backups`フォルダに日時スタンプ付きのバックアップファイルを作成します。

## 4. 手動でClaude Desktop設定を編集

エンコーディングの問題を回避するため、設定ファイルを直接編集します：

1. Visual Studio Codeなどのエディタで設定ファイルを開きます：
   ```
   code %APPDATA%\Claude\claude_desktop_config.json
   ```

2. 以下のポイントを確認・修正してください：
   - すべてのパスで円記号（`\`）が2つになっているか（例: `C:\\Users\\tomoy`）
   - 日本語のパスがエンコードされているか
   - 各サーバーの設定が正しいか

## 5. pnpmへの移行（手動）

pnpmを使用するための手順：

1. pnpmをインストール（まだの場合）：
   ```
   npm install -g pnpm
   ```

2. プロジェクトルートで実行：
   ```
   cd C:\Users\tomoy\Dropbox\01_Dev\STAR-MCP
   pnpm install
   ```

3. 各サブプロジェクトでも同様に実行

## 6. サーバーの再起動

問題が発生した場合は、Claude Desktopを再起動してください：

1. Claude Desktopを閉じる
2. 再度起動する

## 7. ログの確認

再起動後、ログを確認して問題が解決したか確認します：

```powershell
# コマンドプロンプトまたはPowerShellから実行
cd C:\Users\tomoy\Dropbox\01_Dev\STAR-MCP
.\quick-check.bat
```

## トラブルシューティング

- **設定ファイルが見つからない場合**：
  `%APPDATA%\Claude`フォルダが存在するか確認してください。

- **エンコーディングの問題**：
  設定ファイルを手動で編集し、UTF-8 BOMなしで保存してください。

- **サーバーが起動しない**：
  ログファイルを確認して、エラーメッセージを特定してください。

- **pnpmが見つからない**：
  `npm install -g pnpm`で再インストールしてください。
