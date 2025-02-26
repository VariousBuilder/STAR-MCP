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

// ディレクトリ内容のリスト表示ツール
server.tool(
  "list_directory",
  "List contents of a directory",
  {
    directory_path: z.string().describe("Path to the directory to list"),
  },
  async ({ directory_path }) => {
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
      const files = await fs.readdir(directory_path);
      
      // ファイル情報取得
      const fileInfoPromises = files.map(async (file) => {
        const filePath = path.join(directory_path, file);
        try {
          const stats = await fs.stat(filePath);
          return {
            name: file,
            path: filePath,
            isDirectory: stats.isDirectory(),
            size: stats.size,
            modified: stats.mtime.toISOString(),
            created: stats.birthtime.toISOString(),
          };
        } catch (error) {
          return {
            name: file,
            path: filePath,
            error: "Cannot access file information",
          };
        }
      });

      const fileInfoList = await Promise.all(fileInfoPromises);
      
      // ディレクトリと通常ファイルで分けてソート
      const directories = fileInfoList
        .filter((item) => item.isDirectory)
        .sort((a, b) => a.name.localeCompare(b.name));
      
      const files2 = fileInfoList
        .filter((item) => !item.isDirectory && !("error" in item))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      const errorFiles = fileInfoList
        .filter((item) => "error" in item)
        .sort((a, b) => a.name.localeCompare(b.name));

      // レスポンス形成
      let result = `Directory: ${directory_path}\n\n`;
      
      result += "📁 Directories:\n";
      if (directories.length > 0) {
        directories.forEach((dir) => {
          result += `  📁 ${dir.name}/\n`;
        });
      } else {
        result += "  (None)\n";
      }
      
      result += "\n📄 Files:\n";
      if (files2.length > 0) {
        files2.forEach((file) => {
          const sizeStr = formatFileSize(file.size);
          result += `  📄 ${file.name} (${sizeStr}, Modified: ${formatDate(file.modified)})\n`;
        });
      } else {
        result += "  (None)\n";
      }
      
      if (errorFiles.length > 0) {
        result += "\n⚠️ Files with errors:\n";
        errorFiles.forEach((file) => {
          result += `  ⚠️ ${file.name} (${file.error})\n`;
        });
      }

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
            text: `Error listing directory: ${error.message}`,
          },
        ],
      };
    }
  }
);

// ファイル読み取りツール
server.tool(
  "read_file",
  "Read contents of a file",
  {
    file_path: z.string().describe("Path to the file to read"),
  },
  async ({ file_path }) => {
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
);

// ファイル書き込みツール
server.tool(
  "write_file",
  "Write content to a file",
  {
    file_path: z.string().describe("Path to the file to write"),
    content: z.string().describe("Content to write to the file"),
    append: z.boolean().optional().describe("Append to the file instead of overwriting"),
  },
  async ({ file_path, content, append = false }) => {
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

      // 書き込みモード
      const writeMode = append ? fs.appendFile : fs.writeFile;

      // ディレクトリ存在確認
      const dirPath = path.dirname(file_path);
      try {
        await fs.access(dirPath);
      } catch (error) {
        // ディレクトリが存在しない場合は作成
        await fs.mkdir(dirPath, { recursive: true });
      }

      // ファイル書き込み
      await writeMode(file_path, content, "utf-8");

      // ファイル情報を取得
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
);

// ファイル削除ツール
server.tool(
  "delete_file",
  "Delete a file or directory",
  {
    path: z.string().describe("Path to the file or directory to delete"),
    recursive: z.boolean().optional().describe("Delete directories recursively"),
  },
  async ({ path: filePath, recursive = false }) => {
    try {
      // パス検証
      if (!isPathAllowed(filePath)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Access to path "${filePath}" is not allowed`,
            },
          ],
        };
      }

      // ファイル存在確認
      const stats = await fs.stat(filePath);
      
      if (stats.isDirectory()) {
        if (!recursive) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: `Error: "${filePath}" is a directory. Set recursive=true to delete directories.`,
              },
            ],
          };
        }
        
        await fs.rm(filePath, { recursive: true, force: true });
        return {
          content: [
            {
              type: "text",
              text: `Successfully deleted directory: ${filePath}`,
            },
          ],
        };
      } else {
        await fs.unlink(filePath);
        return {
          content: [
            {
              type: "text",
              text: `Successfully deleted file: ${filePath}`,
            },
          ],
        };
      }
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
);

// ディレクトリ作成ツール
server.tool(
  "create_directory",
  "Create a directory",
  {
    directory_path: z.string().describe("Path to the directory to create"),
  },
  async ({ directory_path }) => {
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
);

// ファイル移動・名前変更ツール
server.tool(
  "move_file",
  "Move or rename a file or directory",
  {
    source_path: z.string().describe("Source path of the file or directory"),
    destination_path: z.string().describe("Destination path for the file or directory"),
  },
  async ({ source_path, destination_path }) => {
    try {
      // パス検証
      if (!isPathAllowed(source_path) || !isPathAllowed(destination_path)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Access to path "${!isPathAllowed(source_path) ? source_path : destination_path}" is not allowed`,
            },
          ],
        };
      }

      // ファイル存在確認
      await fs.access(source_path);

      // 宛先ディレクトリ存在確認
      const destDir = path.dirname(destination_path);
      try {
        await fs.access(destDir);
      } catch (error) {
        // 宛先ディレクトリがない場合は作成
        await fs.mkdir(destDir, { recursive: true });
      }

      // ファイル移動
      await fs.rename(source_path, destination_path);

      return {
        content: [
          {
            type: "text",
            text: `Successfully moved file from ${source_path} to ${destination_path}`,
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
);

// ファイル検索ツール
server.tool(
  "search_files",
  "Search for files matching a pattern",
  {
    base_directory: z.string().describe("Base directory to search in"),
    pattern: z.string().describe("Glob pattern to match files (e.g. '**/*.txt')"),
    max_results: z.number().optional().describe("Maximum number of results to return"),
  },
  async ({ base_directory, pattern, max_results = 100 }) => {
    try {
      // パス検証
      if (!isPathAllowed(base_directory)) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: Access to path "${base_directory}" is not allowed`,
            },
          ],
        };
      }

      // ディレクトリ存在確認
      const stats = await fs.stat(base_directory);
      if (!stats.isDirectory()) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: "${base_directory}" is not a directory`,
            },
          ],
        };
      }

      // ファイル検索
      const searchPattern = path.join(base_directory, pattern);
      const files = await glob(searchPattern, { nodir: true });
      
      // 結果数制限
      const limitedFiles = files.slice(0, max_results);
      const hasMore = files.length > max_results;

      // ファイル情報取得
      const fileInfoPromises = limitedFiles.map(async (filePath) => {
        try {
          const stats = await fs.stat(filePath);
          return {
            path: filePath,
            isDirectory: stats.isDirectory(),
            size: stats.size,
            modified: stats.mtime.toISOString(),
            created: stats.birthtime.toISOString(),
          };
        } catch (error) {
          return {
            path: filePath,
            error: "Cannot access file information",
          };
        }
      });

      const fileInfoList = await Promise.all(fileInfoPromises);

      // レスポンス形成
      let result = `Search results for "${pattern}" in ${base_directory}:\n\n`;
      
      if (fileInfoList.length > 0) {
        fileInfoList.forEach((file, index) => {
          const relativePath = path.relative(base_directory, file.path);
          if ("error" in file) {
            result += `${index + 1}. ⚠️ ${relativePath} (${file.error})\n`;
          } else {
            const sizeStr = formatFileSize(file.size);
            result += `${index + 1}. 📄 ${relativePath} (${sizeStr}, Modified: ${formatDate(file.modified)})\n`;
          }
        });
        
        if (hasMore) {
          result += `\n...and ${files.length - max_results} more files (showing first ${max_results} results)`;
        }
      } else {
        result += "No files found matching the pattern.";
      }

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
            text: `Error searching files: ${error.message}`,
          },
        ],
      };
    }
  }
);

// ディレクトリツリー取得ツール
server.tool(
  "get_directory_tree",
  "Get a tree representation of a directory structure",
  {
    directory_path: z.string().describe("Path to the directory to get tree for"),
    max_depth: z.number().optional().describe("Maximum depth to traverse"),
    include_files: z.boolean().optional().describe("Include files in the tree"),
  },
  async ({ directory_path, max_depth = 3, include_files = true }) => {
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

      // ディレクトリツリー生成関数
      async function generateTree(dirPath: string, prefix = "", depth = 1): Promise<string> {
        if (depth > max_depth) {
          return `${prefix}│\n${prefix}└── ... (max depth reached)\n`;
        }

        let result = "";
        
        try {
          const files = await fs.readdir(dirPath);
          const sortedFiles = files.sort();
          
          for (let i = 0; i < sortedFiles.length; i++) {
            const file = sortedFiles[i];
            const filePath = path.join(dirPath, file);
            
            try {
              const stats = await fs.stat(filePath);
              const isLast = i === sortedFiles.length - 1;
              
              // ファイルとディレクトリで処理分岐
              if (stats.isDirectory()) {
                result += `${prefix}${isLast ? "└── " : "├── "}📁 ${file}/\n`;
                
                // サブディレクトリを再帰処理
                result += await generateTree(
                  filePath,
                  `${prefix}${isLast ? "    " : "│   "}`,
                  depth + 1
                );
              } else if (include_files) {
                // ファイルサイズ取得
                const sizeStr = formatFileSize(stats.size);
                result += `${prefix}${isLast ? "└── " : "├── "}📄 ${file} (${sizeStr})\n`;
              }
            } catch (error) {
              // ファイルにアクセスできない場合
              const isLast = i === sortedFiles.length - 1;
              result += `${prefix}${isLast ? "└── " : "├── "}⚠️ ${file} (access error)\n`;
            }
          }
        } catch (error) {
          result += `${prefix}└── ⚠️ Error reading directory\n`;
        }
        
        return result;
      }

      // ツリー生成
      const dirName = path.basename(directory_path);
      let treeOutput = `📁 ${dirName}/\n`;
      treeOutput += await generateTree(directory_path);

      return {
        content: [
          {
            type: "text",
            text: treeOutput,
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
);

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
