# AI会話整理エージェント

このエージェントは、ChatGPT、Claude、Perplexityなどの異なるAIプラットフォームからの会話履歴を収集、分析し、トピックごとに整理してObsidianやその他のマークダウン対応ナレッジベースに保存するためのツールです。

## 機能

- **複数プラットフォームからのデータ収集**：ChatGPT、Claude、Perplexityなどの会話履歴を収集
- **トピック自動検出**：会話内容からトピックを自動検出
- **会話要約**：会話の要点を自動生成
- **マークダウン出力**：Obsidianなどで使いやすい形式で出力
- **クロスリファレンス**：関連トピック間のリンク自動生成
- **MCPサーバー対応**：Model Context Protocolを通じた統合

## セットアップ

### 前提条件

- Node.js 18以上
- TypeScript
- Puppeteer（ブラウザ自動操作用）

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/your-repo/ai-conversation-organizer.git
cd ai-conversation-organizer

# 依存関係のインストール
npm install

# TypeScriptのビルド
npm run build
```

### 設定

`.env.example`ファイルを`.env`にコピーして編集します：

```bash
cp .env.example .env
```

## 使用方法

### MCP経由での使用

Model Context Protocol (MCP)を使用している場合、Claudeなどのホストアプリケーションから直接このエージェントを使用できます。

Claudeの設定ファイルに以下を追加します：

```json
{
  "mcpServers": {
    "conversation-organizer": {
      "command": "node",
      "args": [
        "C:\\path\\to\\STAR-MCP\\agents\\conversation-organizer\\build\\index.js"
      ],
      "env": {
        "CHATGPT_EMAIL": "your.email@example.com",
        "CHATGPT_PASSWORD": "your_password",
        "CLAUDE_LOGS_DIR": "%APPDATA%/Claude/logs"
      }
    }
  }
}
```

### コマンドラインからの使用

```bash
# 会話の整理
npm run organize -- --sources=chatgpt,claude --outputDir=./output

# 特定トピックの抽出
npm run extract -- --topic="TypeScript" --sources=chatgpt,claude --outputFile=./output/typescript.md
```

## カスタマイズ

### トピック定義

`src/processors/topic-detector.ts`を編集して、デフォルトのトピックリストやキーワードマッピングをカスタマイズできます。

### 出力形式

`src/output/markdown.ts`を編集して、マークダウン出力の形式をカスタマイズできます。

## トラブルシューティング

### ブラウザ認証の問題

- ヘッドレスモードをオフにしてブラウザ操作を確認する
- セッションデータを保存して再利用する

### 収集エラー

- ウェブサイトの構造が変更された場合はセレクタを更新する
- レート制限を避けるために適切な遅延を設定する

## プライバシーとセキュリティ

- このツールは常にローカルで実行され、データは外部に送信されません
- 認証情報は`.env`ファイルに保存され、セッションデータはローカルに保存されます
- パスワードなどの機密情報を含むコードをパブリックリポジトリにプッシュしないでください

## ライセンス

This project is licensed under the MIT License - see the LICENSE file for details.
