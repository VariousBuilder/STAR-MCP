// スレッド取得ツール
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gmail_v1 } from "googleapis";
import { formatEmailData } from "../utils/email-formatter.js";

export function registerGetThreadTool(server: McpServer, gmail: gmail_v1.Gmail) {
  server.tool(
    "get-thread",
    "メールスレッドを取得する",
    {
      threadId: z.string().describe("スレッドID"),
    },
    async ({ threadId }) => {
      try {
        const thread = await gmail.users.threads.get({
          userId: "me",
          id: threadId
        });
        
        const messages = thread.data.messages || [];
        const formattedMessages = messages.map(message => formatEmailData(message));
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(formattedMessages, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `スレッド取得中にエラーが発生しました: ${error}`
            }
          ]
        };
      }
    }
  );
}
