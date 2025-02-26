// @ts-ignore
declare module 'isomorphic-fetch' {
    const fetch: typeof globalThis.fetch;
    export default fetch;
}

import { Dropbox } from 'dropbox';
import fetch from 'isomorphic-fetch';
import { z } from 'zod';

const DROPBOX_REFRESH_TOKEN = process.env.DROPBOX_REFRESH_TOKEN;
const DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY;
const DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET;

if (!DROPBOX_REFRESH_TOKEN || !DROPBOX_APP_KEY || !DROPBOX_APP_SECRET) {
    throw new Error('Dropbox API credentials are not set.');
}

const dbx = new Dropbox({
    refreshToken: DROPBOX_REFRESH_TOKEN,
    clientId: DROPBOX_APP_KEY,
    clientSecret: DROPBOX_APP_SECRET,
    fetch, // fetch APIの実装を渡す
});

type ToolDefinition<T> = {
    name: string;
    description: string;
    schema: z.ZodType<T>;
    handler: (args: T) => Promise<{ content: Array<{ type: string; text: string; }> }>;
};

export const dropboxTools: {
    "upload-file": {
        name: string;
        description: string;
        schema: z.ZodObject<{
            path: z.ZodString;
            contents: z.ZodString;
        }>;
        handler: (args: { path: string; contents: string }) => Promise<any>;
    };
    "download-file": {
        name: string;
        description: string;
        schema: z.ZodObject<{
            path: z.ZodString;
        }>;
        handler: (args: { path: string }) => Promise<any>;
    };
    "list-files": {
        name: string;
        description: string;
        schema: z.ZodObject<{
            path: z.ZodString;
        }>;
        handler: (args: { path: string }) => Promise<any>;
    };
} = {
    "upload-file": {
        name: "upload-file",
        description: "指定されたファイルをDropboxにアップロードする",
        schema: z.object({
            path: z.string(),
            contents: z.string()
        }),
        handler: async (args: z.infer<typeof dropboxTools["upload-file"]["schema"]>) => {
            try {
                const response = await dbx.filesUpload({
                    path: args.path,
                    contents: args.contents,
                });
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(response.result)
                    }]
                };
            }
            catch (error: any) {
                console.error('Error uploading file:', error);
                return {
                    content: [{
                        type: "text",
                        text: `Error uploading file: ${error.message}`
                    }]
                };
            }
        }
    },
    "download-file": {
        name: "download-file",
        description: "指定されたファイルをDropboxからダウンロードする",
        schema: z.object({
            path: z.string()
        }),
        handler: async (args: z.infer<typeof dropboxTools["download-file"]["schema"]>) => {
            try {
                const response = await dbx.filesDownload({ path: args.path });
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(response.result)
                    }]
                };
            }
            catch (error: any) {
                console.error('Error downloading file:', error);
                return {
                    content: [{
                        type: "text",
                        text: `Error downloading file: ${error.message}`
                    }]
                };
            }
        }
    },
    "list-files": {
        name: "list-files",
        description: "指定されたフォルダ内のファイル一覧を取得する",
        schema: z.object({
            path: z.string()
        }),
        handler: async (args: z.infer<typeof dropboxTools["list-files"]["schema"]>) => {
            try {
                const response = await dbx.filesListFolder({ path: args.path });
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify(response.result.entries)
                    }]
                };
            }
            catch (error: any) {
                console.error('Error listing files:', error);
                return {
                    content: [{
                        type: "text",
                        text: `Error listing files: ${error.message}`
                    }]
                };
            }
        }
    }
};