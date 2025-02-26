// ラベル一覧取得ツール
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { gmail_v1 } from "googleapis";

export function registerListLabelsTool(server: McpServer, gmail: gmail_v1.Gmail) {
  server.tool(
    "list-labels",
    "Gmailのラベル一覧を取得する",
    {},
    async () => {
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
}
