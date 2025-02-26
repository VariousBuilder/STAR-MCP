// Gmail MCP Server
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { OAuth2Client } from "google-auth-library";
import { google } from "googleapis";
import * as fs from 'fs';
import * as path from 'path';
import 'dotenv/config';

// 全ツールのインポート
import { registerAllTools } from "./tools/index.js";

// サーバーインスタンス作成
const server = new McpServer({
  name: "gmail",
  version: "1.0.0",
});

// 環境変数の取得
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || "http://localhost:3000/oauth2callback";
const TOKEN_DIR = process.env.TOKEN_DIR || "./tokens";

// クライアントIDとシークレットが設定されているか確認
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error("Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env file");
  process.exit(1);
}

// トークンディレクトリが存在しない場合は作成
if (!fs.existsSync(TOKEN_DIR)) {
  fs.mkdirSync(TOKEN_DIR, { recursive: true });
}

// サポートするアカウントリスト
const SUPPORTED_ACCOUNTS = [
  process.env.PRIMARY_GMAIL_ACCOUNT,
  process.env.SECONDARY_GMAIL_ACCOUNT || "tomoya.kotake@gmail.com"
].filter(Boolean); // undefinedの値を除外

// アカウントごとのOAuth2クライアントマップ
const oauth2Clients = new Map<string, OAuth2Client>();

// アカウントごとのGmailクライアントマップ
const gmailClients = new Map<string, google.gmail_v1.Gmail>();

// アカウントごとにGmailクライアントを取得
function getGmailClient(account: string) {
  if (!SUPPORTED_ACCOUNTS.includes(account)) {
    throw new Error(`アカウント ${account} はサポートされていません`);
  }
  
  if (gmailClients.has(account)) {
    return gmailClients.get(account)!;
  }
  
  if (!oauth2Clients.has(account)) {
    const oauth2Client = new OAuth2Client({
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      redirectUri: REDIRECT_URI,
    });
    oauth2Clients.set(account, oauth2Client);
  }
  
  const oauth2Client = oauth2Clients.get(account)!;
  
  const gmailClient = google.gmail({
    version: "v1",
    auth: oauth2Client
  });
  
  gmailClients.set(account, gmailClient);
  
  return gmailClient;
}

// 全アカウントのGmailクライアントを取得
function getAllGmailClients() {
  const clients: {[account: string]: google.gmail_v1.Gmail} = {};
  
  for (const account of SUPPORTED_ACCOUNTS) {
    try {
      clients[account] = getGmailClient(account);
    } catch (error) {
      console.error(`アカウント ${account} のGmailクライアント取得に失敗しました:`, error);
    }
  }
  
  return clients;
}

// 特定のアカウントのトークンパスを取得
function getTokenPath(account: string) {
  return path.join(TOKEN_DIR, `gmail-token-${account.replace('@', '-at-')}.json`);
}

// トークンのリフレッシュと保存を管理
async function getAuthenticatedClient(account: string) {
  if (!SUPPORTED_ACCOUNTS.includes(account)) {
    throw new Error(`アカウント ${account} はサポートされていません`);
  }
  
  const oauth2Client = oauth2Clients.get(account) || new OAuth2Client({
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUri: REDIRECT_URI,
  });
  
  oauth2Clients.set(account, oauth2Client);
  
  try {
    const tokenPath = getTokenPath(account);
    
    // トークンファイルが存在するか確認
    if (fs.existsSync(tokenPath)) {
      const tokenContent = fs.readFileSync(tokenPath, 'utf-8');
      const tokens = JSON.parse(tokenContent);
      oauth2Client.setCredentials(tokens);
      
      // トークンの有効期限をチェック
      if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
        console.error(`アカウント ${account} の認証トークンの期限が切れています。再認証を行います。`);
        return await performAuth(account);
      }
      
      return oauth2Client;
    } else {
      console.error(`アカウント ${account} の認証トークンが見つかりません。認証フローを開始します。`);
      return await performAuth(account);
    }
  } catch (error) {
    console.error(`アカウント ${account} のトークンの読み込みに失敗しました。認証フローを開始します。`, error);
    return await performAuth(account);
  }
}

// 認証フロー実行
async function performAuth(account: string) {
  const oauth2Client = oauth2Clients.get(account)!;
  
  // 認証URLを生成
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.labels',
      'https://www.googleapis.com/auth/gmail.metadata'
    ],
    // ユーザーにログインするアカウントを指定
    login_hint: account
  });
  
  console.error(`アカウント ${account} の認証を行います`);
  console.error("以下のURLにアクセスして認証を行ってください:");
  console.error(authUrl);
  console.error("認証完了後、リダイレクトされたURLのコードパラメータを入力してください:");
  
  // 通常はここでユーザーからの入力を待ちますが、デスクトップアプリケーションの場合は
  // 別の方法で認証コードを取得する実装が必要です。
  // この例では簡略化のためにサンプルトークンを提供しています。
  // 実際の実装では、ユーザーからの入力を待つか、ローカルサーバーでリダイレクトを受け取る必要があります。
  
  // 本来はここに認証コードの入力を受け付けるコードを書きます
  // この例ではここで処理が止まります
  
  throw new Error(`アカウント ${account} の認証が必要です。上記のURLにアクセスして認証を完了してください。`);
  
  // 以下は認証コード取得後の処理
  // const code = "取得した認証コード";
  // const { tokens } = await oauth2Client.getToken(code);
  // oauth2Client.setCredentials(tokens);
  
  // トークンを保存
  // const tokenPath = getTokenPath(account);
  // fs.writeFileSync(tokenPath, JSON.stringify(tokens));
  // console.error(`アカウント ${account} のトークンを保存しました:`, tokenPath);
  
  // return oauth2Client;
}

// サポート済みアカウント一覧を取得
function getSupportedAccounts() {
  return SUPPORTED_ACCOUNTS;
}

// サーバー起動
async function main() {
  try {
    console.error("Gmail MCP Serverを起動しています...");
    console.error(`サポートするアカウント: ${SUPPORTED_ACCOUNTS.join(', ')}`);
    
    // すべてのアカウントで認証準備
    for (const account of SUPPORTED_ACCOUNTS) {
      try {
        await getAuthenticatedClient(account);
        console.error(`アカウント ${account} の認証完了`);
      } catch (error) {
        console.error(`アカウント ${account} の認証に失敗しました: ${error}`);
        // 認証エラーがあっても続行（後で再認証可能）
      }
    }
    
    // 全ツールを登録
    registerAllTools(server, {
      getAllGmailClients,
      getGmailClient,
      supportedAccounts: SUPPORTED_ACCOUNTS
    });
    
    // サーバー起動
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Gmail MCP Server running on stdio");
  } catch (error) {
    console.error("Failed to start Gmail MCP Server:", error);
    process.exit(1);
  }
}

// メインの実行
main().catch(error => {
  console.error("Fatal error:", error);
  process.exit(1);
});
