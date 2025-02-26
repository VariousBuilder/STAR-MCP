/**
 * Brave Search MCP Server
 * 
 * このサーバーはModel Context Protocol (MCP)を使用して、
 * Brave Search APIを介したウェブ検索機能を提供します。
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import fetchData from './fetch.js';

// Brave Search API Key
const BRAVE_API_KEY = process.env.BRAVE_API_KEY;

// サーバーの設定
const server = new McpServer({
  name: "brave-search",
  version: "1.0.0",
});

// 検索ツールの定義
server.tool(
  "search",
  "インターネット上の情報を検索します",
  {
    query: z.string().describe("検索クエリ"),
    count: z.number().optional().describe("取得する結果の数 (デフォルト: 5)"),
    country: z.string().optional().describe("検索対象の国 (例: US, JP)"),
  },
  async ({ query, count = 5, country = "JP" }) => {
    try {
      if (!BRAVE_API_KEY) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Brave Search API Keyが設定されていません。環境変数BRAVE_API_KEYを設定してください。",
            },
          ],
        };
      }

      const results = await fetchData(query, count, country, BRAVE_API_KEY);
      
      return {
        content: [
          {
            type: "text",
            text: results,
          },
        ],
      };
    } catch (error: any) {
      console.error("[BraveSearch] Error:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `検索エラー: ${error.message}`,
          },
        ],
      };
    }
  }
);

// ニュース検索ツールの定義
server.tool(
  "news",
  "最新のニュース記事を検索します",
  {
    query: z.string().describe("検索クエリ"),
    count: z.number().optional().describe("取得する結果の数 (デフォルト: 5)"),
    country: z.string().optional().describe("検索対象の国 (例: US, JP)"),
  },
  async ({ query, count = 5, country = "JP" }) => {
    try {
      if (!BRAVE_API_KEY) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "Brave Search API Keyが設定されていません。環境変数BRAVE_API_KEYを設定してください。",
            },
          ],
        };
      }

      const results = await fetchData(query, count, country, BRAVE_API_KEY, true);
      
      return {
        content: [
          {
            type: "text",
            text: results,
          },
        ],
      };
    } catch (error: any) {
      console.error("[BraveSearch] Error:", error);
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `ニュース検索エラー: ${error.message}`,
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
  console.error("Brave Search MCP Server running on stdio transport");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
