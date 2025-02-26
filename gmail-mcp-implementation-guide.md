# Gmail MCP 実装ガイド

このガイドはSTAR-MCPシステムにおけるGmail MCP（Model Context Protocol）サーバーの実装方法を詳説します。Gmail MCPは、ユーザーのGmailアカウントから情報を安全に取得し、メールデータをSTAR-MCPエコシステムに統合するための重要なコンポーネントです。

## 1. 概要

Gmail MCPは以下の主要機能を提供します：

- Gmail APIを介したメールデータアクセス
- メールコンテンツの取得と構造化
- 添付ファイルの管理とGoogle Driveとの連携
- メールからのコンテキスト抽出とタスク認識
- 高度なメール検索と分類機能

## 2. アーキテクチャ

Gmail MCPは以下のコンポーネントで構成されます：

### 2.1 コアモジュール
- **Auth Module**: OAuth 2.0認証とトークン管理
- **API Client**: Gmail APIとの通信
- **Data Processor**: メールデータの処理と変換
- **Storage Manager**: データの永続化
- **Context Extractor**: コンテキスト情報の抽出

### 2.2 連携モジュール
- **DB Connector Interface**: 各種データベースとの連携
- **Event Publisher**: イベント通知システム
- **Agent Communicator**: AIエージェントとの連携

### 2.3 ツールとリソース
- **Search Tools**: 高度なメール検索機能
- **Filter Tools**: メールフィルタリング機能
- **Task Extraction Tools**: タスク抽出と優先度付け
- **Content Resources**: メール本文とメタデータ提供

## 3. 実装手順

### 3.1 環境設定

1. **Google API設定**
   - Google Cloud Consoleでプロジェクト作成
   - Gmail APIの有効化
   - OAuth 2.0クライアントIDの設定
   - 必要なAPIスコープの設定

2. **開発環境構築**
   - Node.js v16+
   - TypeScript 4.5+
   - 必要なパッケージ：
     - @google/auth-library
     - googleapis
     - @modelcontextprotocol/sdk

### 3.2 基本構造実装

```typescript
// Gmail MCP Server - 基本構造
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { OAuth2Client } from "google-auth-library";
import { gmail_v1, google } from "googleapis";
import { z } from "zod";

// サーバーインスタンス作成
const server = new McpServer({
  name: "gmail",
  version: "1.0.0",
});

// Google認証クライアント
const oauth2Client = new OAuth2Client({
  clientId: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  redirectUri: process.env.REDIRECT_URI || "http://localhost:3000/oauth2callback",
});

// Gmailクライアント
const gmail = google.gmail({
  version: "v1",
  auth: oauth2Client
});

// トークンのリフレッシュと保存を管理
async function getAuthenticatedClient() {
  // トークン情報の読み込み
  try {
    const tokenPath = process.env.TOKEN_PATH || "./gmail-token.json";
    const tokens = require(tokenPath);
    oauth2Client.setCredentials(tokens);
  } catch (error) {
    console.error("トークンの読み込みに失敗しました。認証が必要です。");
    // 認証フローの実装...
  }
  return oauth2Client;
}

// MCP Serverにツールとリソースを登録

// 1. メール検索ツール
server.tool(
  "search-emails",
  "メールを検索する",
  {
    query: z.string().describe("検索クエリ（Gmail検索構文に準拠）"),
    maxResults: z.number().min(1).max(100).default(10).describe("最大結果数"),
  },
  async ({ query, maxResults }) => {
    await getAuthenticatedClient();
    
    try {
      const res = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: maxResults
      });
      
      const messages = res.data.messages || [];
      const emailDetails = await Promise.all(
        messages.map(async (message) => {
          const details = await gmail.users.messages.get({
            userId: "me",
            id: message.id || "",
            format: "full"
          });
          return formatEmailData(details.data);
        })
      );
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(emailDetails, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `メール検索中にエラーが発生しました: ${error}`
          }
        ]
      };
    }
  }
);

// 2. メール詳細取得ツール
server.tool(
  "get-email",
  "メールの詳細を取得する",
  {
    messageId: z.string().describe("メールID"),
  },
  async ({ messageId }) => {
    await getAuthenticatedClient();
    
    try {
      const details = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full"
      });
      
      const formattedEmail = formatEmailData(details.data);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(formattedEmail, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `メール詳細取得中にエラーが発生しました: ${error}`
          }
        ]
      };
    }
  }
);

// 3. ラベル一覧取得ツール
server.tool(
  "list-labels",
  "Gmailのラベル一覧を取得する",
  {},
  async () => {
    await getAuthenticatedClient();
    
    try {
      const res = await gmail.users.labels.list({
        userId: "me"
      });
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(res.data.labels, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `ラベル一覧取得中にエラーが発生しました: ${error}`
          }
        ]
      };
    }
  }
);

// 4. タスク抽出ツール
server.tool(
  "extract-tasks",
  "メールからタスクを抽出する",
  {
    messageId: z.string().describe("メールID"),
  },
  async ({ messageId }) => {
    await getAuthenticatedClient();
    
    try {
      // メール取得
      const details = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full"
      });
      
      const formattedEmail = formatEmailData(details.data);
      
      // タスク抽出は別途AI処理で実装予定
      // ここではサンプルとして簡易実装
      const taskInfo = extractTaskInfo(formattedEmail);
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(taskInfo, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `タスク抽出中にエラーが発生しました: ${error}`
          }
        ]
      };
    }
  }
);

// ユーティリティ関数

// メールデータのフォーマット関数
function formatEmailData(message: gmail_v1.Schema$Message) {
  // Gmail APIのヘッダーから情報を抽出
  const headers = message.payload?.headers || [];
  
  const getHeader = (name: string) => {
    const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
    return header?.value || "";
  };
  
  // 本文を扱いやすい形式に変換
  const body = message.payload?.body?.data || 
               message.payload?.parts?.find(part => part.mimeType === "text/plain")?.body?.data || "";
  
  const decodedBody = body ? Buffer.from(body, "base64").toString("utf-8") : "";
  
  // 添付ファイル情報の抽出
  const attachments = [];
  const processParts = (parts: gmail_v1.Schema$MessagePart[] | undefined) => {
    if (!parts) return;
    
    for (const part of parts) {
      if (part.filename && part.filename.length > 0) {
        attachments.push({
          id: part.body?.attachmentId || "",
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body?.size || 0
        });
      }
      
      if (part.parts) {
        processParts(part.parts);
      }
    }
  };
  
  processParts(message.payload?.parts);
  
  return {
    id: message.id,
    threadId: message.threadId,
    labelIds: message.labelIds,
    snippet: message.snippet,
    from: getHeader("from"),
    to: getHeader("to"),
    subject: getHeader("subject"),
    date: getHeader("date"),
    body: decodedBody,
    hasAttachments: attachments.length > 0,
    attachments: attachments
  };
}

// タスク情報抽出関数 (簡易実装)
function extractTaskInfo(email: any) {
  // 実際の実装ではLLMやルールベースの分析を使用
  const taskKeywords = [
    {お願い, 依頼, 期限, deadline, ただちに, urgent, 緊急, 必要, 提出, submit}
  ];
  
  const deadlinePattern = /\b(\d{1,2}[\/\.\-]\d{1,2})([\/\.\-]\d{2,4})?\b|\b(\d{4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,2})\b/g;
  const potentialDeadlines = email.body.match(deadlinePattern) || [];
  
  // 簡易的に可能性のあるタスクを検出
  const taskIndicators = taskKeywords.some(keyword => 
    email.subject.toLowerCase().includes(keyword.toLowerCase()) || 
    email.body.toLowerCase().includes(keyword.toLowerCase())
  );
  
  return {
    emailId: email.id,
    potentialTask: taskIndicators,
    title: taskIndicators ? `RE: ${email.subject}` : "",
    potentialDeadlines: potentialDeadlines,
    priority: calculatePriority(email),
    actionRequired: taskIndicators
  };
}

// 優先度計算関数 (簡易実装)
function calculatePriority(email: any) {
  let score = 5; // デフォルトの優先度
  
  // 送信者の重要度による調整
  const importantSenders = [
    "boss@example.com", "client@example.com"
  ]; // 実際は設定から読み込む
  
  if (importantSenders.some(sender => email.from.includes(sender))) {
    score += 2;
  }
  
  // 件名に緊急を示す言葉があれば優先度を上げる
  const urgentKeywords = ["urgent", "緊急", "至急", "ASAP", "immediately"];
  if (urgentKeywords.some(keyword => email.subject.toLowerCase().includes(keyword.toLowerCase()))) {
    score += 3;
  }
  
  // ラベルによる優先度調整
  if (email.labelIds && email.labelIds.includes("IMPORTANT")) {
    score += 1;
  }
  
  return Math.min(Math.max(score, 1), 10); // 1-10の範囲で返す
}

// サーバー起動
async function main() {
  try {
    // 認証準備
    await getAuthenticatedClient();
    
    // 起動
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Gmail MCP Server running on stdio");
  } catch (error) {
    console.error("Failed to start Gmail MCP Server:", error);
    process.exit(1);
  }
}

main().catch(console.error);
```
