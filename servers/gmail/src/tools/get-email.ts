// メール詳細取得ツール
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gmail_v1 } from "googleapis";
import { formatEmailData } from "../utils/email-formatter.js";

export function registerGetEmailTool(server: McpServer, gmail: gmail_v1.Gmail) {
  server.tool(
    "get-email",
    "メールの詳細を取得する",
    {
      messageId: z.string().describe("メールID"),
    },
    async ({ messageId }) => {
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
}
