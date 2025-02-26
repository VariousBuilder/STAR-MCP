// src/tools/google-drive.ts
import { authorize } from '../config/google/drive.js';
import { drive_v3 } from 'googleapis';
import { z } from 'zod';

const TASK_LIST_PATH = 'マイドライブ/02_生活/Obsidian Vault/task_list.md';

export const googleDriveTools = {
  "read-task-list": {
    name: "read-task-list",
    description: "Obsidianのタスクリストを読み込む",
    schema: z.object({}),
    handler: async () => {
      try {
        const drive = await authorize();
        
        // ファイルを検索（パスでの検索）
        const listResponse = await drive.files.list({
          q: `name='task_list.md' and 'root' in parents`,
          fields: 'files(id, name)',
        });

        const fileId = listResponse.data.files?.[0]?.id;
        if (!fileId) {
          return {  // ここにreturnを追加
            content: [{
              type: "text",
              text: "タスクリストが見つかりませんでした"
            }]
          };
        }

        // ファイルの内容を取得
        const getResponse = await drive.files.get({
          fileId: fileId,
          alt: 'media',
        }, {
          responseType: 'text'
        });

        const content = getResponse.data as string;

        return {
          content: [{
            type: "text",
            text: content  // dataをcontentに変更
          }]
        };
      } catch (error: any) {
        console.error('Error:', error);
        return {
          content: [{
            type: "text",
            text: `エラーが発生しました: ${error.message}`
          }]
        };
      }
    }
  },

  "update-task-list": {
    name: "update-task-list",
    description: "タスクリストを更新する",
    schema: z.object({
      content: z.string()
    }),
    handler: async ({ content }: { content: string }) => {
      try {
        const drive = await authorize();

        // 既存のファイルを検索
        const response = await drive.files.list({
          q: `name='task_list.md' and 'root' in parents`,
          fields: 'files(id, name)'
        });

        let fileId = response.data.files?.[0]?.id;

        if (fileId) {
          // 既存ファイルの更新
          await drive.files.update({
            fileId: fileId,
            media: {
              body: content
            }
          });
        } else {
          // 新規ファイルの作成
          await drive.files.create({
            requestBody: {
              name: 'task_list.md',
              mimeType: 'text/markdown'
            },
            media: {
              body: content
            }
          });
        }

        return {
          content: [{
            type: "text",
            text: "タスクリストを更新しました"
          }]
        };
      } catch (error: any) {
        console.error('Error:', error);
        return {
          content: [{
            type: "text",
            text: `エラーが発生しました: ${error.message}`
          }]
        };
      }
    }
  }
};