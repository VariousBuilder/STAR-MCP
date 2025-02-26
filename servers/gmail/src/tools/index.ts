// ツール登録まとめ
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { gmail_v1 } from "googleapis";
import { z } from "zod";

import { registerSearchEmailsTool } from "./search-emails.js";
import { registerGetEmailTool } from "./get-email.js";
import { registerListLabelsTool } from "./list-labels.js";
import { registerExtractTasksTool } from "./extract-tasks.js";
import { registerGetAttachmentTool } from "./get-attachment.js";
import { registerGetThreadTool } from "./get-thread.js";
import { registerAnalyzeSenderTool } from "./analyze-sender.js";
import { registerGetDashboardDataTool } from "./get-dashboard-data.js";

// マルチアカウント管理用インターフェース
interface GmailManager {
  getAllGmailClients: () => {[account: string]: gmail_v1.Gmail};
  getGmailClient: (account: string) => gmail_v1.Gmail;
  supportedAccounts: string[];
}

// 全ツールを登録する関数
export function registerAllTools(
  server: McpServer, 
  gmailManager: GmailManager
) {
  // 各ツールに全アカウントのGmailクライアントを渡すために調整が必要
  // 各ツールが個別に全アカウントをサポートできるまでは、デフォルトアカウントのみを使用
  const defaultAccount = gmailManager.supportedAccounts[0];
  const defaultGmailClient = gmailManager.getGmailClient(defaultAccount);
  
  // 既存ツールの登録（現状はデフォルトアカウントのみ対応）
  registerSearchEmailsTool(server, defaultGmailClient);
  registerGetEmailTool(server, defaultGmailClient);
  registerListLabelsTool(server, defaultGmailClient);
  registerExtractTasksTool(server, defaultGmailClient);
  registerGetAttachmentTool(server, defaultGmailClient);
  registerGetThreadTool(server, defaultGmailClient);
  registerAnalyzeSenderTool(server, defaultGmailClient);
  registerGetDashboardDataTool(server, defaultGmailClient);
  
  // マルチアカウント対応ツールの登録
  registerMultiAccountTools(server, gmailManager);
  
  console.error("全ツールを登録しました");
}

// マルチアカウント対応ツールを登録
function registerMultiAccountTools(
  server: McpServer,
  gmailManager: GmailManager
) {
  // 全アカウントからメールを同時検索するツール
  server.addTool({
    name: "search-all-accounts",
    description: "すべてのGmailアカウントからメールを検索します。複数アカウントの結果を統合して返します。",
    parameters: z.object({
      query: z.string().describe("検索クエリ。Gmail検索構文を使用できます。"),
      maxResults: z.number().optional().describe("各アカウントあたりの最大結果数 (デフォルト: 10)"),
    }),
    handler: async (params) => {
      const { query, maxResults = 10 } = params;
      const allClients = gmailManager.getAllGmailClients();
      const results: { account: string; messages: any[] }[] = [];
      
      // 各アカウントで検索を実行
      for (const [account, gmail] of Object.entries(allClients)) {
        try {
          const response = await gmail.users.messages.list({
            userId: 'me',
            q: query,
            maxResults: maxResults,
          });
          
          const messages = response.data.messages || [];
          const detailedMessages = [];
          
          // 各メッセージの詳細を取得
          for (const message of messages) {
            try {
              const msgDetail = await gmail.users.messages.get({
                userId: 'me',
                id: message.id!,
                format: 'metadata',
                metadataHeaders: ['Subject', 'From', 'To', 'Date'],
              });
              
              const headers = msgDetail.data.payload?.headers || [];
              const subject = headers.find(h => h.name === 'Subject')?.value || '(件名なし)';
              const from = headers.find(h => h.name === 'From')?.value || '';
              const date = headers.find(h => h.name === 'Date')?.value || '';
              
              detailedMessages.push({
                id: message.id,
                threadId: message.threadId,
                snippet: msgDetail.data.snippet,
                subject,
                from,
                date,
              });
            } catch (error) {
              console.error(`メッセージ ${message.id} の詳細取得に失敗: ${error}`);
            }
          }
          
          results.push({
            account,
            messages: detailedMessages,
          });
        } catch (error) {
          console.error(`アカウント ${account} の検索に失敗: ${error}`);
          results.push({
            account,
            messages: [],
            error: `検索に失敗しました: ${error}`,
          });
        }
      }
      
      return {
        results,
        totalAccounts: Object.keys(allClients).length,
        query,
      };
    },
  });

  // すべてのアカウントからラベル一覧を取得するツール
  server.addTool({
    name: "list-all-labels",
    description: "すべてのGmailアカウントのラベル一覧を取得します",
    parameters: z.object({}),
    handler: async () => {
      const allClients = gmailManager.getAllGmailClients();
      const results: { account: string; labels: any[] }[] = [];
      
      for (const [account, gmail] of Object.entries(allClients)) {
        try {
          const response = await gmail.users.labels.list({
            userId: 'me',
          });
          
          results.push({
            account,
            labels: response.data.labels || [],
          });
        } catch (error) {
          console.error(`アカウント ${account} のラベル取得に失敗: ${error}`);
          results.push({
            account,
            labels: [],
            error: `ラベル取得に失敗しました: ${error}`,
          });
        }
      }
      
      return {
        results,
        totalAccounts: Object.keys(allClients).length,
      };
    },
  });

  // サポート済みアカウント一覧取得ツール
  server.addTool({
    name: "get-accounts-info",
    description: "サポートされているGmailアカウントの情報を取得します",
    parameters: z.object({}),
    handler: async () => {
      return {
        accounts: gmailManager.supportedAccounts,
        totalAccounts: gmailManager.supportedAccounts.length,
      };
    },
  });
}
