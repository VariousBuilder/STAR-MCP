// 送信者分析用ユーティリティ
import { gmail_v1, google } from "googleapis";
import { formatEmailData } from "./email-formatter.js";
import { extractCommonTopics, extractCommonPhrases } from "./analyzer.js";
import { OAuth2Client } from "google-auth-library";

// 送信者分析用の関数
export async function analyzeSender(email: string, gmail: gmail_v1.Gmail) {
  try {
    // 送信者からのメールを取得
    const res = await gmail.users.messages.list({
      userId: "me",
      q: `from:${email}`,
      maxResults: 50
    });
    
    const messages = res.data.messages || [];
    if (messages.length === 0) {
      return {
        email: email,
        messageCount: 0,
        averageResponseTime: null,
        commonTopics: [],
        commonPhrases: [],
        lastContactDate: null
      };
    }
    
    // メッセージの詳細を取得
    const messageDetails = await Promise.all(
      messages.map(async (message) => {
        const details = await gmail.users.messages.get({
          userId: "me",
          id: message.id || "",
          format: "full"
        });
        return formatEmailData(details.data);
      })
    );
    
    // データ分析
    const dates = messageDetails.map(m => new Date(m.date)).sort((a, b) => a.getTime() - b.getTime());
    const subjects = messageDetails.map(m => m.subject);
    const bodies = messageDetails.map(m => m.body);
    
    // 応答時間の計算（簡易実装）
    let responseTimes: number[] = [];
    for (let i = 1; i < dates.length; i++) {
      const diff = dates[i].getTime() - dates[i-1].getTime();
      responseTimes.push(diff / (1000 * 60 * 60)); // 時間単位
    }
    
    const avgResponseTime = responseTimes.length ? 
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : null;
    
    // トピック分析（簡易実装）
    const commonTopics = extractCommonTopics(subjects);
    
    // 頻出フレーズ（簡易実装）
    const commonPhrases = extractCommonPhrases(bodies);
    
    return {
      email: email,
      messageCount: messages.length,
      firstContactDate: dates[0]?.toISOString(),
      lastContactDate: dates[dates.length - 1]?.toISOString(),
      averageResponseTime: avgResponseTime,
      commonTopics: commonTopics,
      commonPhrases: commonPhrases
    };
  } catch (error) {
    console.error("送信者分析中にエラーが発生しました:", error);
    return {
      email: email,
      error: "分析中にエラーが発生しました"
    };
  }
}
