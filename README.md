# STAR-MCP エコシステム

STAR-MCP（Specialized Tools and Applications for Reliable Model Context Protocol）は、建築業界向けに特化されたAIエージェント組織を構築するエコシステムです。MCPサーバーを通じて、AIに多様なデータソースとツールへのアクセスを提供します。

## 概要

STAR-MCPは以下の目標を持っています：

- 建築業界の作業フローを効率化するAIエージェントの提供
- 多様なデータソースへの統一されたアクセス
- LLMと連携したワークフローの自動化
- AIの適応性と信頼性の向上

## システム構成図（エコマップ）

STAR-MCPエコシステムの最終目標となるシステム構成図です。
このエコシステムは、ユーザーインターフェース層、コアシステム層、データストア層、MCPサーバー層、AIエージェント層、外部システム層から構成されています。

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'width': 1800, 'height': 1000 }}}%%
graph TB
    %% ユーザーインターフェース層
    User((("ユーザー"))) === Interface

    subgraph Interface["ユーザーインターフェース"]
        Dashboard["3D可視化\nダッシュボード"]
        Chat["対話\nインターフェース"]
        Notify["通知\nシステム"]
    end

    %% コアシステム層 - 中央に配置
    subgraph Core["コアシステム"]
        Orchestrator["Orchestrator\nMCPサーバー管理"]
        AIEngine["AI Engine\nエージェント実行基盤"]
        ReslientAgent["Resilient Agent\nエラー耐性フレームワーク"]
        DBConnector["DB Connector\n統合データ管理"]
        EvoEngine["Evolution Engine\n自己進化処理"]
    end

    %% データストア層 - コアの下に配置
    subgraph DataStore["データストア層"]
        PostgreSQL[("PostgreSQL\n構造化データ")]
        VectorDB[("Vector DB\n非構造化データ")]
        Neo4j[("Neo4j\nグラフデータ")]
        TimeseriesDB[("TimescaleDB\n時系列データ")]
    end

    %% MCPサーバー層 - スター型に放射状に配置
    subgraph Servers["MCPサーバー層"]
        GDrive["Google Drive MCP"]
        Gmail["Gmail MCP"]
        BraveSearch["Brave Search MCP"]
        Dropbox["Dropbox MCP"]
        Notion["Notion MCP"]
        Supabase["Supabase MCP"]
        Cursor["Cursor MCP"]
        TechScout["Tech Scout MCP"]
        Scheduler["Scheduler MCP"]
    end

    %% AIエージェント層 - スター型に放射状に配置
    subgraph Agents["AIエージェント層"]
        TaskOpt["タスク最適化\nエージェント"]
        TechScoutAgent["技術スカウト\nエージェント"]
        ConvOrganizer["会話整理\nエージェント"]
        ContextManager["コンテキスト管理\nエージェント"]
        EmailAssistant["メール処理\nエージェント"]
    end

    %% 外部システム層
    subgraph External["外部システム・データソース"]
        GDriveAPI["Google Drive API"]
        GmailAPI["Gmail API"]
        BraveAPI["Brave Search API"]
        DropboxAPI["Dropbox API"]
        NotionAPI["Notion API"]
        TytanAPI["Tytan API"]
        ArXivAPI["ArXiv API"]
        GitHubAPI["GitHub API"]
        ChatGPT["ChatGPT"]
        Claude["Claude"]
        Perplexity["Perplexity"]
    end

    %% スター型の接続関係を表現
    Interface === Core
    Core === DataStore
    
    %% サーバーとコアの接続（スター型）
    Core === GDrive
    Core === Gmail
    Core === BraveSearch
    Core === Dropbox
    Core === Notion
    Core === Supabase
    Core === Cursor
    Core === TechScout
    Core === Scheduler
    
    %% エージェントとコアの接続（スター型）
    Core === TaskOpt
    Core === TechScoutAgent
    Core === ConvOrganizer
    Core === ContextManager
    Core === EmailAssistant
    
    %% 外部APIとの接続
    GDrive --- GDriveAPI
    Gmail --- GmailAPI
    BraveSearch --- BraveAPI
    Dropbox --- DropboxAPI
    Notion --- NotionAPI
    Scheduler --- TytanAPI
    TechScout --- ArXivAPI
    TechScout --- GitHubAPI
    ConvOrganizer --- ChatGPT
    ConvOrganizer --- Claude
    ConvOrganizer --- Perplexity
```

## コンポーネント

STAR-MCPエコシステムは以下のコンポーネントで構成されています：

### コアシステム

- **STAR-MCP Core**: エコシステム全体を管理するコアサーバー
- **共有データレイヤー**: MCPサーバー間でデータを共有するための中央リポジトリ
- **レジリエントエージェントフレームワーク**: エラー耐性と自動リカバリー機能を提供
- **AI実行エンジン**: エージェントの実行と管理を担当

### 統合されたMCPサーバー

- **ファイルシステム**: ローカルファイルへのアクセス
- **Google Drive**: クラウドストレージとの統合
- **Brave Search**: ウェブ検索機能
- **Obsidian**: ナレッジベースへのアクセス
- **Notion**: プロジェクト管理ツールとの統合
- **Gmail**: メール管理とタスク抽出
- **Dropbox**: ファイル共有との統合
- **Supabase**: データベース接続

### AIエージェント

- **会話整理エージェント**: AI会話履歴の整理と要約
- **タスク最適化エージェント**: 優先順位付けとスケジューリング
- **テックスカウトエージェント**: 新技術のモニタリングと評価
- **コンテキスト管理エージェント**: 会話コンテキストの最適化
- **メール処理アシスタント**: メールの分類と応答支援

## セットアップ

詳細なセットアップ手順については、[SETUP_GUIDE.md](./SETUP_GUIDE.md)を参照してください。

基本的な手順:

1. リポジトリのクローン
2. 依存関係のインストール: `./install-deps.bat`
3. Claude Desktopの設定: `claude_desktop_config.json`を適切な場所にコピー
4. Claude Desktopの再起動

## 使用方法

STAR-MCPエコシステムは、Claude Desktopと統合して使用します。セットアップが完了すると、Claude Desktopから以下の機能にアクセスできます：

- ローカルファイルの検索と読み取り
- ウェブ検索の実行
- Obsidianボールトからの情報取得
- STAR-MCPのシステム情報とステータスの確認

## 開発

STAR-MCPエコシステムへの貢献を歓迎します。開発には以下のツールが必要です：

- Node.js 18以上
- TypeScript
- npm or yarn

詳細については、[CONTRIBUTING.md](./CONTRIBUTING.md)を参照してください。

## ステータス

このプロジェクトはまだ開発中であり、一部の機能は未実装または不安定です。進捗状況は[progress.md](./progress.md)で確認できます。

## ライセンス

MIT

## 連絡先

質問や提案がある場合は、Issues機能を使用してください。
