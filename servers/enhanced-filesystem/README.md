# Enhanced Filesystem MCP Server

STAR-MCPエコシステムのための拡張ファイルシステムサーバー。基本的なファイルシステム操作に加えて、ディレクトリツリー表示、高度な検索機能、ファイル内容解析などの機能を提供します。

## 機能

- 標準的なファイルシステム操作（読み取り、書き込み、削除、移動など）
- ディレクトリツリー構造の取得・表示
- 高度なファイル検索（内容・メタデータ検索）
- ファイルタイプごとのコンテンツ抽出と解析
- ファイル変更の監視と通知

## 使用方法

```bash
# インストールと実行
npm install
npm run build
node build/index.js [アクセス許可するディレクトリパス...]
```

## Claude Desktop での設定例

```json
{
  "mcpServers": {
    "enhanced-filesystem": {
      "command": "node",
      "args": [
        "C:\\Users\\tomoy\\Dropbox\\01_Dev\\STAR-MCP\\servers\\enhanced-filesystem\\build\\index.js",
        "C:\\Users\\tomoy"
      ]
    }
  }
}
```

## 利用可能なツール

- `list_directory`: ディレクトリの内容をリスト表示
- `search_files`: ファイルを検索（ファイル名、内容、メタデータ）
- `get_directory_tree`: ディレクトリ構造をツリー形式で取得
- `read_file`: ファイルの内容を読み取り
- `write_file`: ファイルに内容を書き込み
- `delete_file`: ファイルを削除
- `move_file`: ファイルを移動または名前変更
- `create_directory`: ディレクトリを作成
