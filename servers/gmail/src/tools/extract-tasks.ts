// タスク抽出ツール
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gmail_v1 } from "googleapis";
import { formatEmailData } from "../utils/email-formatter.js";
import { extractTaskInfo } from "../utils/task-extractor.js";

export function registerExtractTasksTool(server: McpServer, gmail: gmail_v1.Gmail) {
  server.tool(
    "extract-tasks",
    "メールからタスクを抽出する",
    {
      messageId: z.string().describe("メールID"),
    },
    async ({ messageId }) => {
      try {
        // メール取得
        const details = await gmail.users.messages.get({
          userId: "me",
          id: messageId,
          format: "full"
        });
        
        const formattedEmail = formatEmailData(details.data);
        
        // タスク抽出
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
}
