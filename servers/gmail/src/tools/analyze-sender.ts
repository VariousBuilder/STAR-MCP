// 送信者分析ツール
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { gmail_v1 } from "googleapis";
import { analyzeSender } from "../utils/sender-analyzer.js";

export function registerAnalyzeSenderTool(server: McpServer, gmail: gmail_v1.Gmail) {
  server.tool(
    "analyze-sender",
    "送信者のメールデータを分析する",
    {
      email: z.string().email().describe("分析する送信者のメールアドレス"),
    },
    async ({ email }) => {
      try {
        const analysis = await analyzeSender(email, gmail);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(analysis, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `送信者分析中にエラーが発生しました: ${error}`
            }
          ]
        };
      }
    }
  );
}
