// メール検索ツール
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gmail_v1 } from "googleapis";
import { formatEmailData } from "../utils/email-formatter.js";

export function registerSearchEmailsTool(server: McpServer, gmail: gmail_v1.Gmail) {
  server.tool(
    "search-emails",
    "メールを検索する",
    {
      query: z.string().describe("検索クエリ（Gmail検索構文に準拠）"),
      maxResults: z.number().min(1).max(100).default(10).describe("最大結果数"),
    },
    async ({ query, maxResults }) => {
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
}
