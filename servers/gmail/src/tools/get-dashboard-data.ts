// ダッシュボードデータ取得ツール
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { gmail_v1 } from "googleapis";
import { getDashboardData } from "../utils/dashboard.js";

export function registerGetDashboardDataTool(server: McpServer, gmail: gmail_v1.Gmail) {
  server.tool(
    "get-dashboard-data",
    "メールダッシュボード用のデータを取得する",
    {},
    async () => {
      try {
        const dashboardData = await getDashboardData(gmail);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(dashboardData, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `ダッシュボードデータ取得中にエラーが発生しました: ${error}`
            }
          ]
        };
      }
    }
  );
}
