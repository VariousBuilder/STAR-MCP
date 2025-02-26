// メールフォーマット用ユーティリティ
import { gmail_v1 } from "googleapis";

// メールデータのフォーマット関数
export function formatEmailData(message: gmail_v1.Schema$Message) {
  // Gmail APIのヘッダーから情報を抽出
  const headers = message.payload?.headers || [];
  
  const getHeader = (name: string) => {
    const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
    return header?.value || "";
  };
  
  // 本文を扱いやすい形式に変換
  const body = message.payload?.body?.data || 
               message.payload?.parts?.find(part => part.mimeType === "text/plain")?.body?.data || "";
  
  const decodedBody = body ? Buffer.from(body, 'base64').toString('utf-8') : "";
  
  // 添付ファイル情報の抽出
  const attachments: any[] = [];
  const processParts = (parts: gmail_v1.Schema$MessagePart[] | undefined) => {
    if (!parts) return;
    
    for (const part of parts) {
      if (part.filename && part.filename.length > 0) {
        attachments.push({
          id: part.body?.attachmentId || "",
          filename: part.filename,
          mimeType: part.mimeType,
          size: part.body?.size || 0
        });
      }
      
      if (part.parts) {
        processParts(part.parts);
      }
    }
  };
  
  processParts(message.payload?.parts);
  
  return {
    id: message.id,
    threadId: message.threadId,
    labelIds: message.labelIds,
    snippet: message.snippet,
    from: getHeader("from"),
    to: getHeader("to"),
    cc: getHeader("cc"),
    subject: getHeader("subject"),
    date: getHeader("date"),
    body: decodedBody,
    hasAttachments: attachments.length > 0,
    attachments: attachments
  };
}
