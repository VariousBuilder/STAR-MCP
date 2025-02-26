// ダッシュボードデータ取得用ユーティリティ
import { gmail_v1 } from "googleapis";

// ダッシュボードデータ取得用の関数
export async function getDashboardData(gmail: gmail_v1.Gmail) {
  try {
    // 最近のメール統計を取得
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = Math.floor(oneWeekAgo.getTime() / 1000);
    
    const recentRes = await gmail.users.messages.list({
      userId: "me",
      q: `after:${oneWeekAgoStr}`,
      maxResults: 100
    });
    
    // ラベル情報を取得
    const labelsRes = await gmail.users.labels.list({
      userId: "me"
    });
    
    const labels = labelsRes.data.labels || [];
    
    // ラベルごとのメッセージ数を取得
    const labelCounts = await Promise.all(
      labels.map(async (label) => {
        try {
          const labelRes = await gmail.users.messages.list({
            userId: "me",
            labelIds: [label.id || ""],
            maxResults: 1
          });
          
          return {
            name: label.name,
            id: label.id,
            count: labelRes.data.resultSizeEstimate
          };
        } catch (error) {
          console.error(`ラベル ${label.name} の情報取得中にエラーが発生しました:`, error);
          return {
            name: label.name,
            id: label.id,
            count: 0
          };
        }
      })
    );
    
    // 時間帯ごとのメール受信数（簡易実装）
    const hourlyDistribution = Array(24).fill(0);
    
    // 送信者分布（簡易実装）
    const senderDistribution: { [key: string]: number } = {};
    
    // 本来はここでメッセージの詳細を取得して統計を計算
    // 簡易実装としてダミーデータを返す
    
    return {
      totalMessages: recentRes.data.resultSizeEstimate,
      unreadCount: labelCounts.find(l => l.name === "UNREAD")?.count || 0,
      importantCount: labelCounts.find(l => l.name === "IMPORTANT")?.count || 0,
      labelDistribution: labelCounts,
      hourlyDistribution: hourlyDistribution,
      senderDistribution: Object.entries(senderDistribution)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
    };
  } catch (error) {
    console.error("ダッシュボードデータ取得中にエラーが発生しました:", error);
    return {
      error: "データ取得中にエラーが発生しました"
    };
  }
}
