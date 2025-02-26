# Gmail MCP Server

STAR-MCPシステム用のGmail統合サーバーです。Gmail APIを使用してメールデータにアクセスし、STAR-MCPエコシステムに統合します。

## 機能

- Gmail APIを使用したメールデータアクセス
- メールコンテンツの取得と構造化
- 添付ファイルの管理
- メールからのコンテキスト抽出とタスク認識
- 高度なメール検索と分類
- 送信者分析
- ダッシュボードデータ生成
- **複数Gmailアカウントの同時アクセス**
- **複数アカウントの結果を統合表示**

## セットアップ

### 前提条件

- Node.js v16以上
- npm または yarn
- Google Cloud Projectの作成とGmail APIの有効化

### インストール

```bash
# 依存関係のインストール
npm install

# TypeScriptのビルド
npm run build
```

### 設定

1. `.env.example`を`.env`にコピーして編集します:

```bash
cp .env.example .env
```

2. Google Cloud Consoleで以下の設定を行います:
   - プロジェクトを作成
   - Gmail APIを有効化
   - OAuth 2.0クライアントIDを設定
   - 必要なスコープを設定

3. 取得した情報を`.env`ファイルに記入します:

```
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
REDIRECT_URI=http://localhost:3000/oauth2callback

# 複数のアカウントを設定
PRIMARY_GMAIL_ACCOUNT=your_primary_gmail@gmail.com
SECONDARY_GMAIL_ACCOUNT=tomoya.kotake@gmail.com
```

## 使用方法

### サーバーの起動

```bash
npm start
```

初回実行時は各アカウントごとに認証が必要です。表示されるURLにアクセスし、対応するGoogleアカウントで認証してください。

### Claude for Desktopとの統合

`claude_desktop_config.json`に以下の設定を追加します:

```json
{
  "mcpServers": {
    "gmail": {
      "command": "npm",
      "args": ["start"],
      "cwd": "/path/to/STAR-MCP/servers/gmail"
    }
  }
}
```

## 提供するツール

### 従来のツール（デフォルトアカウント向け）

1. **search-emails**: メールを検索する
2. **get-email**: 特定のメールの詳細を取得する
3. **list-labels**: Gmailのラベル一覧を取得する
4. **extract-tasks**: メールからタスクを抽出する
5. **get-attachment**: メールの添付ファイルを取得する
6. **get-thread**: メールスレッドを取得する
7. **analyze-sender**: 送信者のメールデータを分析する
8. **get-dashboard-data**: メールダッシュボード用のデータを取得する

### マルチアカウント対応ツール（全アカウント対応）

9. **search-all-accounts**: 全アカウントからメールを同時検索
10. **list-all-labels**: 全アカウントのラベル一覧を取得
11. **get-accounts-info**: サポートされているアカウント情報を取得

## マルチアカウント機能

このサーバーは複数のGmailアカウントを同時に利用でき、全アカウントからのデータを一度に取得・表示できます。アカウントを切り替える必要がなく、すべてのアカウントを一度に操作できるので効率的です。

### マルチアカウント対応ツールの使用例

```
// 全アカウントからメールを検索
search-all-accounts(query: "重要 プロジェクト", maxResults: 5)

// 全アカウントのラベル一覧を取得
list-all-labels()

// サポートされているアカウント情報を取得
get-accounts-info()
```

### 応答フォーマット

マルチアカウント対応ツールからの応答には、各アカウントの結果と、それがどのアカウントからのものかを示す情報が含まれます。例えば：

```json
{
  "results": [
    {
      "account": "primary@gmail.com",
      "messages": [...]
    },
    {
      "account": "tomoya.kotake@gmail.com",
      "messages": [...]
    }
  ],
  "totalAccounts": 2,
  "query": "重要 プロジェクト"
}
```

## 注意事項

- 認証トークンは`TOKEN_DIR`で指定したディレクトリにアカウントごとに保存されます
- トークンには機密情報が含まれるため、安全に管理してください
- Gmail APIのAPIリクエスト制限に注意してください
- 各アカウントは個別に認証が必要です
- マルチアカウント機能を利用すると、APIリクエスト数が増加します

## 既存システムとの統合

- **Google Drive MCP**: 認証共有メカニズムで連携
- **スケジューラMCP**: メールから抽出したタスク・予定を最適スケジューリング
- **コンテキストマネージャー**: メールスレッドのグラフベース表現と統合コンテキスト
