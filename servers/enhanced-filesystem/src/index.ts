#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import * as mime from "mime-types";
import { glob } from "glob";

// サーバーのバージョン
const VERSION = "1.0.0";

// コマンドライン引数を取得
const allowedPaths = process.argv.slice(2);

const requestSchema = z.object({
  method: z.literal("tools/call"),
  params: z.object({
    name: z.string(),
    arguments: z.any().optional(),
  }).optional(),
});




// 許可されたパスが指定されていない場合はエラー
if (allowedPaths.length === 0) {
  console.error("Error: No allowed paths specified");
  console.error("Usage: node build/index.js <allowed_path_1> [<allowed_path_2> ...]");
  process.exit(1);
}

// 許可されたパスを絶対パスに変換して存在確認
const resolvedAllowedPaths = allowedPaths.map(p => {
  const resolved = path.resolve(p);
  if (!existsSync(resolved)) {
    console.error(`Warning: Specified path does not exist: ${resolved}`);
  }
  return resolved;
});

console.error(`Enhanced Filesystem Server ${VERSION}`);
console.error(`Allowed paths: ${resolvedAllowedPaths.join(", ")}`);

// サーバーインスタンスの作成
const server = new Server(
  {
    name: "enhanced-filesystem",
    version: VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// パスが許可されているか確認するヘルパー関数
function isPathAllowed(filePath: string): boolean {
  const resolvedPath = path.resolve(filePath);
  return resolvedAllowedPaths.some(allowedPath => 
    resolvedPath === allowedPath || resolvedPath.startsWith(allowedPath + path.sep)
  );
}

// ======== ツール実装 ========
// ツールのメソッドを登録

// ディレクトリ内容のリスト表示ツール
server.setRequestHandler(requestSchema, async (request) => {
  const toolName = request.params?.name;
  const args = request.params?.arguments || {};

  // ツール名に基づいて処理を分岐
  switch (toolName) {
    case "list_directory": {
      const directory_path = args.directory_path as string;
      try {
        // パス検証
        if (!isPathAllowed(directory_path)) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Access to path "${directory_path}" is not allowed`,
              },
            ],
          };
        }

        // ディレクトリ存在確認
        const stats = await fs.stat(directory_path);
        if (!stats.isDirectory()) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: "${directory_path}" is not a directory`,
              },
            ],
          };
        }

        // ディレクトリ内容の取得
        const entries = await fs.readdir(directory_path, { withFileTypes: true });
        const contents = await Promise.all(
          entries.map(async (entry) => {
            const fullPath = path.join(directory_path, entry.name);
            const stats = await fs.stat(fullPath);
            const isDir = stats.isDirectory();
            const size = !isDir ? formatFileSize(stats.size) : "";
            const modifiedAt = formatDate(stats.mtime.toISOString());

            return {
              name: entry.name,
              path: fullPath,
              isDirectory: isDir,
              size,
              modifiedAt,
            };
          })
        );

        // 結果の整形とソート（ディレクトリ優先）
        contents.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

        // 結果を返す
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(contents, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error listing directory: ${error.message}`,
            },
          ],
        };
      }
    }
    
    case "read_file": {
      const file_path = args.file_path as string;
      try {
        // パス検証
        if (!isPathAllowed(file_path)) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Access to path "${file_path}" is not allowed`,
              },
            ],
          };
        }

        // ファイル存在確認
        const stats = await fs.stat(file_path);
        if (!stats.isFile()) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: "${file_path}" is not a file`,
              },
            ],
          };
        }

        // ファイルサイズ確認 (安全のため)
        const MAX_SIZE = 10 * 1024 * 1024; // 10MB
        if (stats.size > MAX_SIZE) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: File "${file_path}" is too large (${formatFileSize(stats.size)}). Maximum size is ${formatFileSize(MAX_SIZE)}.`,
              },
            ],
          };
        }

        // MIMEタイプを取得
        const mimeType = mime.lookup(file_path) || "application/octet-stream";
        
        // テキストファイルのみ対応
        if (!mimeType.startsWith("text/") && 
            mimeType !== "application/json" && 
            mimeType !== "application/javascript" && 
            mimeType !== "application/xml") {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: File "${file_path}" is not a text file. MIME type: ${mimeType}`,
              },
            ],
          };
        }

        // ファイル読み取り
        const content = await fs.readFile(file_path, "utf-8");
        
        // ファイル情報を含めて返す
        const result = `File: ${file_path}\nSize: ${formatFileSize(stats.size)}\nModified: ${stats.mtime.toISOString()}\nType: ${mimeType}\n\n${content}`;

        return {
          content: [
            {
              type: "text",
              text: result,
            },
          ],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error reading file: ${error.message}`,
            },
          ],
        };
      }
    }

    case "write_file": {
      const file_path = args.file_path as string;
      const content = args.content as string;
      const append = args.append as boolean || false;
      
      try {
        // パス検証
        if (!isPathAllowed(file_path)) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Access to path "${file_path}" is not allowed`,
              },
            ],
          };
        }

        // ディレクトリが存在するか確認
        const dir = path.dirname(file_path);
        try {
          await fs.access(dir);
        } catch (error) {
          // ディレクトリが存在しない場合は作成
          await fs.mkdir(dir, { recursive: true });
        }

        // ファイル書き込み（追記または上書き）
        if (append) {
          await fs.appendFile(file_path, content, "utf-8");
        } else {
          await fs.writeFile(file_path, content, "utf-8");
        }

        // 更新されたファイル情報を取得
        const stats = await fs.stat(file_path);

        return {
          content: [
            {
              type: "text",
              text: `Successfully ${append ? "appended to" : "wrote"} file: ${file_path}\nSize: ${formatFileSize(stats.size)}\nModified: ${stats.mtime.toISOString()}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error writing to file: ${error.message}`,
            },
          ],
        };
      }
    }

    case "delete_file": {
      const file_path = args.file_path as string;
      
      try {
        // パス検証
        if (!isPathAllowed(file_path)) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Access to path "${file_path}" is not allowed`,
              },
            ],
          };
        }

        // ファイル存在確認
        try {
          const stats = await fs.stat(file_path);
          if (!stats.isFile()) {
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Error: "${file_path}" is not a file`,
                },
              ],
            };
          }
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: File "${file_path}" does not exist`,
              },
            ],
          };
        }

        // ファイル削除
        await fs.unlink(file_path);

        return {
          content: [
            {
              type: "text",
              text: `Successfully deleted file: ${file_path}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error deleting file: ${error.message}`,
            },
          ],
        };
      }
    }

    case "create_directory": {
      const directory_path = args.directory_path as string;
      
      try {
        // パス検証
        if (!isPathAllowed(directory_path)) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Access to path "${directory_path}" is not allowed`,
              },
            ],
          };
        }

        // ディレクトリ作成
        await fs.mkdir(directory_path, { recursive: true });

        return {
          content: [
            {
              type: "text",
              text: `Successfully created directory: ${directory_path}`,
            },
          ],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error creating directory: ${error.message}`,
            },
          ],
        };
      }
    }

    case "search_files": {
      const search_path = args.search_path as string;
      const pattern = args.pattern as string;
      
      try {
        // パス検証
        if (!isPathAllowed(search_path)) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Access to path "${search_path}" is not allowed`,
              },
            ],
          };
        }

        // ファイル存在確認
        const stats = await fs.stat(search_path);
        if (!stats.isDirectory()) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: "${search_path}" is not a directory`,
              },
            ],
          };
        }

        // glob検索
        const files = await glob(`${search_path}/**/${pattern}`, {
          absolute: true,
          nodir: true,
        });

        // 結果整形
        const result = files.map(file => {
          // 許可されたパスのみ含める
          if (isPathAllowed(file)) return file;
          return null;
        }).filter(Boolean);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error searching files: ${error.message}`,
            },
          ],
        };
      }
    }

    case "get_directory_tree": {
      const directory_path = args.directory_path as string;
      const max_depth = args.max_depth as number || 3;
      
      try {
        // パス検証
        if (!isPathAllowed(directory_path)) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Access to path "${directory_path}" is not allowed`,
              },
            ],
          };
        }

        // ディレクトリ存在確認
        const stats = await fs.stat(directory_path);
        if (!stats.isDirectory()) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: "${directory_path}" is not a directory`,
              },
            ],
          };
        }

        // 再帰的にディレクトリツリーを生成する関数
        async function generateTree(dirPath: string, prefix = "", depth = 1): Promise<string> {
          if (depth > max_depth) {
            return `${prefix}... (max depth reached)\n`;
          }

          try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            let result = "";

            // ディレクトリとファイルを分けてソート
            const dirs = entries.filter(e => e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));
            const files = entries.filter(e => !e.isDirectory()).sort((a, b) => a.name.localeCompare(b.name));

            // ディレクトリを先に処理
            for (let i = 0; i < dirs.length; i++) {
              const dir = dirs[i];
              const isLast = i === dirs.length - 1 && files.length === 0;
              const connector = isLast ? "└── " : "├── ";
              const newPrefix = prefix + (isLast ? "    " : "│   ");
              
              result += `${prefix}${connector}📁 ${dir.name}/\n`;
              
              const fullPath = path.join(dirPath, dir.name);
              if (isPathAllowed(fullPath)) {
                result += await generateTree(fullPath, newPrefix, depth + 1);
              } else {
                result += `${newPrefix}... (access restricted)\n`;
              }
            }

            // ファイルを処理
            for (let i = 0; i < files.length; i++) {
              const file = files[i];
              const isLast = i === files.length - 1;
              const connector = isLast ? "└── " : "├── ";
              
              // ファイルサイズを取得
              const filePath = path.join(dirPath, file.name);
              let sizeInfo = "";
              
              if (isPathAllowed(filePath)) {
                try {
                  const stats = await fs.stat(filePath);
                  sizeInfo = ` (${formatFileSize(stats.size)})`;
                } catch (e) {
                  sizeInfo = " (error getting size)";
                }
              }
              
              result += `${prefix}${connector}📄 ${file.name}${sizeInfo}\n`;
            }

            return result;
          } catch (error) {
            return `${prefix}Error reading directory: ${error}\n`;
          }
        }

        // ルートディレクトリ名を含めたツリーを生成
        const dirName = path.basename(directory_path);
        const tree = `📁 ${dirName}/ (${directory_path})\n${await generateTree(directory_path)}`;

        return {
          content: [
            {
              type: "text",
              text: tree,
            },
          ],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error generating directory tree: ${error.message}`,
            },
          ],
        };
      }
    }

    case "move_file": {
      const source_path = args.source_path as string;
      const target_path = args.target_path as string;
      
      try {
        // パス検証
        if (!isPathAllowed(source_path)) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Access to source path "${source_path}" is not allowed`,
              },
            ],
          };
        }
        
        if (!isPathAllowed(target_path)) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Access to target path "${target_path}" is not allowed`,
              },
            ],
          };
        }

        // ソースファイル存在確認
        try {
          await fs.access(source_path);
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: Source file "${source_path}" does not exist`,
              },
            ],
          };
        }

        // ターゲットディレクトリがない場合は作成
        const targetDir = path.dirname(target_path);
        try {
          await fs.access(targetDir);
        } catch (error) {
          await fs.mkdir(targetDir, { recursive: true });
        }

        // ファイル移動
        await fs.rename(source_path, target_path);

        return {
          content: [
            {
              type: "text",
              text: `Successfully moved file from "${source_path}" to "${target_path}"`,
            },
          ],
        };
      } catch (error: any) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error moving file: ${error.message}`,
            },
          ],
        };
      }
    }

    default:
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `Error: Unknown tool "${toolName}"`,
          },
        ],
      };
  }
});

// ヘルパー関数: ファイルサイズのフォーマット
function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}

// ヘルパー関数: 日付のフォーマット
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString();
}

// サーバーの起動
async function main() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Enhanced Filesystem MCP Server running on stdio");
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

main();
