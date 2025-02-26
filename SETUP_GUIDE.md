# STAR-MCP エコシステム セットアップガイド

このガイドではSTAR-MCPエコシステムのセットアップ方法を説明します。STAR-MCPは、建築業界向けのAIエージェントを提供するエコシステムです。

## 前提条件

- Windows 11/10
- Node.js 18以上がインストールされていること
- Claude Desktopがインストールされていること

## インストール手順

1. **依存関係のインストール**

   `install-deps.bat`スクリプトを実行して、必要なパッケージをインストールします。

   ```bash
   # プロジェクトルートディレクトリで実行
   .\install-deps.bat
   ```

2. **Claude Desktopの設定**

   `claude_desktop_config.json`ファイルをClaude Desktopの設定ディレクトリにコピーします。

   ```bash
   # Windowsの場合
   copy claude_desktop_config.json %APPDATA%\Claude\claude_desktop_config.json
   ```

3. **Claude Desktopの再起動**

   設定を適用するために、Claude Desktopを再起動します。

## 含まれるMCPサーバー

STAR-MCPエコシステムには以下のMCPサーバーが含まれています：

1. **star-mcp**：コアサーバー
   - システム全体の状態を管理
   - 共有データへのアクセスを提供

2. **filesystem**：ファイルシステムサーバー
   - ローカルファイルへのアクセスを提供

3. **brave-search**：検索サーバー
   - ウェブ検索機能を提供

4. **obsidian**：Obsidianサーバー
   - Obsidianボールトへのアクセスを提供

## トラブルシューティング

### ログの確認

問題が発生した場合は、Claude Desktopのログを確認してください：

```bash
# Windowsの場合
type %APPDATA%\Claude\logs\mcp*.log
```

### 一般的な問題と解決策

1. **サーバーが接続できない場合**
   - パスに日本語やスペースが含まれていないか確認
   - 環境変数が正しく設定されているか確認
   - Node.jsのバージョンが18以上であることを確認

2. **'パッケージが見つからない'エラー**
   - `install-deps.bat`を再実行してください
   - npmのキャッシュをクリアしてから再試行：`npm cache clean --force`

## 次のステップ

- カスタムエージェントの開発
- 新しいMCPサーバーの追加
- ワークフローの自動化

詳細については、プロジェクトのドキュメントを参照してください。
