# STAR-MCP プロジェクト引き継ぎガイドライン

## プロジェクト環境
### 既存ディレクトリ構造
- C:\Users\tomoy\Dropbox\01_Dev\STAR-MCP (メイン開発ディレクトリ - 存在済)
- C:\Users\tomoy\Dropbox\01_Dev\MCP (MCPサーバーディレクトリ - 存在済)
- C:\Users\tomoy\AppData\Roaming\Claude (Claude設定ディレクトリ - 存在済)

### プロジェクト進捗状況
- [完了] 基本設計、要件定義
- [進行中] MCPサーバー拡張実装、引き継ぎメカニズム改善
- [未着手] Obsidian連携、Notion連携

## 自動引き継ぎプロトコル
1. 常に `C:\Users\tomoy\Dropbox\01_Dev\STAR-MCP\latest_handover.json` に最新の作業状態を保存
2. 作業中も定期的に引き継ぎファイルを更新（5分間隔を目安）
3. 新しいチャットでは「続き」「STAR-MCP」などの簡単な指示で自動的に前回の作業を検出して継続
4. 引き継ぎ時にはステータスサマリーを表示（完了タスク、進行中タスク、次のタスク）

## 手動引き継ぎ（自動検出に失敗した場合）
ユーザー: 「前回の内容を load_handover.ps1 で読み込んで」
ChatGPT: PowerShellスクリプトを実行し、前回の作業状態を復元

## 引き継ぎ情報の構造
- timestamp: 最終更新日時
- topic: プロジェクト名/作業内容
- status: タスクの進捗状況（完了/進行中/次）
- current_context: 現在の作業の説明
- code_progress: 実装中のコードの進捗
- errors: 発生しているエラーとその状態
- resources: 関連するファイルパスやURL

## 引き継ぎツール
1. `update_handover.ps1`: 引き継ぎ情報を更新するスクリプト
2. `load_handover.ps1`: 引き継ぎ情報を読み込むスクリプト

## 注意事項
- 引き継ぎ情報は常に最新の状態を保つこと
- コード変更やタスク状態の変化があれば必ず更新すること
- プロジェクトパスやリソース情報は絶対パスで記録すること
