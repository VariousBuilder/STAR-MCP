// 添付ファイル取得ツール
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gmail_v1 } from "googleapis";

export function registerGetAttachmentTool(server: McpServer, gmail: gmail_v1.Gmail) {
  server.tool(
    "get-attachment",
    "メールの添付ファイルを取得する",
    {
      messageId: z.string().describe("メールID"),
      attachmentId: z.string().describe("添付ファイルID"),
    },
    async ({ messageId, attachmentId }) => {
      try {
        const attachment = await gmail.users.messages.attachments.get({
          userId: "me",
          messageId: messageId,
          id: attachmentId
        });
        
        const data = attachment.data.data;
        
        if (!data) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: "添付ファイルデータを取得できませんでした"
              }
            ]
          };
        }
        
        return {
          content: [
            {
              type: "text",
              text: `添付ファイルデータ (Base64): ${data}`
            }
          ]
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `添付ファイル取得中にエラーが発生しました: ${error}`
            }
          ]
        };
      }
    }
  );
}
