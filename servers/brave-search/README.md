# Brave Search MCP Server

このMCPサーバーは、Brave Search APIを使用してインターネット検索機能を提供します。Claudeなどの大規模言語モデルに最新のウェブ情報を提供するために使用できます。

## セットアップ

### 1. 前提条件

- Node.js v18以上
- Brave Search API Key (https://api.search.brave.com/app/ から取得)

### 2. ビルド方法

```bash
# 依存関係のインストール
npm install

# TypeScriptのビルド
npm run build
```

### 3. Claudeデスクトップでの設定方法

Claudeデスクトップの設定ファイル (`claude_desktop_config.json`) に以下を追加してください：

```json
{
  "mcpServers": {
    "brave-search": {
      "command": "node",
      "args": ["C:\\Users\\tomoy\\Dropbox\\01_Dev\\STAR-MCP\\servers\\brave-search\\build\\index.js"],
      "env": {
        "BRAVE_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

または公式のサーバーを使用する場合：

```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "YOUR_API_KEY_HERE"
      }
    }
  }
}
```

### 4. 使用方法

サーバーが正しく設定されていれば、Claudeデスクトップ内で以下のようなプロンプトを使用できます：

- "最近の東京オリンピックについて教えて"
- "人工知能の最新動向を調べて"
- "2025年の注目技術トレンドは？"

## 提供ツール

1. `search` - 一般的なウェブ検索を行います
2. `news` - 最新ニュース記事を検索します

## トラブルシューティング

- エラー「Brave Search API Keyが設定されていません」：環境変数が正しく設定されているか確認してください
- 検索結果が返ってこない：インターネット接続とAPIキーの有効性を確認してください
