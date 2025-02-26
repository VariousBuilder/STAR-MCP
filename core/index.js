// STAR-MCP Core Server
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListResourcesRequestSchema, ReadResourceRequestSchema, ListPromptsRequestSchema, ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

// 環境変数からパスを取得
const SHARED_DATA_PATH = process.env.SHARED_MCP_DATA || path.join(process.cwd(), 'shared');
const OBSIDIAN_VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH || '';

// サーバーインスタンスの作成
const server = new Server({
    name: "star-mcp",
    version: "1.0.0"
}, {
    capabilities: {
        tools: {},
        resources: {},
        prompts: {}
    }
});

// 基本的なリソース管理
server.setRequestHandler(ListResourcesRequestSchema, async () => {
    console.error("Listing resources");
    try {
        // ベーシックなリソースリストを返す
        return {
            resources: [
                {
                    uri: "star-mcp://status",
                    name: "STAR-MCP Status",
                    description: "Current status of the STAR-MCP ecosystem"
                }
            ]
        };
    } catch (error) {
        console.error("Error listing resources:", error);
        throw error;
    }
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    console.error(`Reading resource: ${uri}`);

    try {
        if (uri === "star-mcp://status") {
            return {
                contents: [
                    {
                        uri: uri,
                        mimeType: "text/plain",
                        text: "STAR-MCP Ecosystem Status:\n" +
                              "- Core: Online\n" +
                              "- Shared Data Path: " + SHARED_DATA_PATH + "\n" +
                              "- Obsidian Vault Path: " + OBSIDIAN_VAULT_PATH
                    }
                ]
            };
        }

        throw new Error(`Resource not found: ${uri}`);
    } catch (error) {
        console.error(`Error reading resource ${uri}:`, error);
        throw error;
    }
});

// ツール機能の実装
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "get_system_info",
                description: "Get information about the STAR-MCP system",
                inputSchema: {
                    type: "object",
                    properties: {}
                }
            }
        ]
    };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.error(`Tool call: ${name}`, args);

    try {
        if (name === "get_system_info") {
            return {
                content: [
                    {
                        type: "text",
                        text: "STAR-MCP System Information:\n" +
                              "- Version: 1.0.0\n" +
                              "- Node.js: " + process.version + "\n" +
                              "- Platform: " + process.platform + "\n" +
                              "- Architecture: " + process.arch
                    }
                ]
            };
        }

        throw new Error(`Tool not found: ${name}`);
    } catch (error) {
        console.error(`Error calling tool ${name}:`, error);
        return {
            isError: true,
            content: [
                {
                    type: "text",
                    text: `Error: ${error.message}`
                }
            ]
        };
    }
});

// プロンプト機能（基本的なものを実装）
server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
        prompts: [
            {
                name: "system_help",
                description: "Get help with STAR-MCP ecosystem"
            }
        ]
    };
});

// メイン関数
async function main() {
    try {
        console.error("Starting STAR-MCP Core Server...");
        // 環境変数のチェック
        console.error(`SHARED_MCP_DATA: ${SHARED_DATA_PATH}`);
        console.error(`OBSIDIAN_VAULT_PATH: ${OBSIDIAN_VAULT_PATH || 'Not set'}`);

        // 共有データディレクトリの存在確認・作成
        if (!fs.existsSync(SHARED_DATA_PATH)) {
            console.error(`Creating shared data directory: ${SHARED_DATA_PATH}`);
            fs.mkdirSync(SHARED_DATA_PATH, { recursive: true });
        }

        const transport = new StdioServerTransport();
        console.error("Transport created, connecting...");
        await server.connect(transport);
        console.error("STAR-MCP Core Server running on stdio");
    }
    catch (error) {
        console.error("Error during server startup:", error);
        throw error;
    }
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
