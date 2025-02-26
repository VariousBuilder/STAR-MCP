/**
 * AI会話整理エージェント
 * 
 * このエージェントは、ChatGPT、Claude、Perplexityなどの
 * 過去の会話履歴を収集、分析、整理し、トピックごとに
 * 構造化された知識ベースを構築します。
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { OrganizeConversations } from "./organizer.js";

// サーバーの設定
const server = new McpServer({
  name: "conversation-organizer",
  version: "1.0.0",
});

// 会話整理ツールの定義
server.tool(
  "organize-conversations",
  "過去のAI会話を収集し、トピックごとに整理します",
  {
    sources: z.array(z.string()).describe("収集元（chatgpt, claude, perplexity）"),
    outputDir: z.string().describe("出力先ディレクトリ"),
    groupByTopic: z.boolean().optional().describe("トピックごとにグループ化するか"),
  },
  async ({ sources, outputDir, groupByTopic = true }) => {
    try {
      // 会話整理の実行
      const organizer = new OrganizeConversations();
      const result = await organizer.execute(sources, outputDir, groupByTopic);
      
      return {
        content: [
          {
            type: "text",
            text: `会話整理が完了しました。\n\n${result}`,
          },
        ],
      };
    } catch (error: any) {
      console.error("[ConversationOrganizer] Error:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `会話整理エラー: ${error.message}`,
          },
        ],
      };
    }
  }
);

// 特定トピックの会話抽出ツール
server.tool(
  "extract-topic",
  "特定のトピックに関する会話を抽出します",
  {
    topic: z.string().describe("抽出するトピック"),
    sources: z.array(z.string()).describe("収集元（chatgpt, claude, perplexity）"),
    outputFile: z.string().describe("出力先ファイル"),
  },
  async ({ topic, sources, outputFile }) => {
    try {
      // トピック抽出の実行
      const organizer = new OrganizeConversations();
      const result = await organizer.extractTopic(topic, sources, outputFile);
      
      return {
        content: [
          {
            type: "text",
            text: `トピック「${topic}」の会話抽出が完了しました。\n\n${result}`,
          },
        ],
      };
    } catch (error: any) {
      console.error("[ConversationOrganizer] Error:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `トピック抽出エラー: ${error.message}`,
          },
        ],
      };
    }
  }
);

// サーバー起動
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Conversation Organizer MCP Server running on stdio transport");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
