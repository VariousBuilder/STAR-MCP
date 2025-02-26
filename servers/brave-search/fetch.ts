/**
 * Brave Search API通信ユーティリティ
 */

/**
 * Brave Search APIから検索結果を取得します
 * @param query 検索クエリ
 * @param count 取得する結果の数
 * @param country 検索対象の国
 * @param apiKey Brave Search API Key
 * @param isNews ニュース検索モードを使用するかどうか
 * @returns フォーマット済みの検索結果テキスト
 */
export default async function fetchData(
  query: string,
  count: number = 5,
  country: string = "JP",
  apiKey: string,
  isNews: boolean = false
): Promise<string> {
  const endpoint = "https://api.search.brave.com/res/v1/web/search";
  
  const params = new URLSearchParams({
    q: query,
    count: count.toString(),
    country: country,
  });

  if (isNews) {
    params.append("news", "true");
  }

  try {
    const response = await fetch(`${endpoint}?${params.toString()}`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        "X-Subscription-Token": apiKey
      }
    });

    if (!response.ok) {
      throw new Error(`API エラー: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return formatSearchResults(data, isNews);
  } catch (error: any) {
    console.error("Fetch error:", error);
    throw new Error(`検索リクエスト失敗: ${error.message}`);
  }
}

/**
 * 検索結果をフォーマットします
 * @param data API応答データ
 * @param isNews ニュース検索モードかどうか
 * @returns フォーマット済みのテキスト
 */
function formatSearchResults(data: any, isNews: boolean): string {
  if (!data.web?.results?.length && !data.news?.results?.length) {
    return "検索結果はありませんでした。";
  }

  const results = isNews ? data.news?.results : data.web?.results;
  if (!results || !results.length) {
    return "検索結果はありませんでした。";
  }

  let formattedText = isNews ? "# ニュース検索結果\n\n" : "# 検索結果\n\n";

  results.forEach((result: any, index: number) => {
    const title = result.title || "タイトルなし";
    const url = result.url || "";
    const description = result.description || "";
    const ageText = result.age ? `(${result.age})` : "";

    formattedText += `## ${index + 1}. ${title} ${ageText}\n`;
    formattedText += `URL: ${url}\n`;
    formattedText += `${description}\n\n`;
  });

  if (data.query?.altered_query) {
    formattedText += `\n注: "${data.query.altered_query}" で検索を行いました。`;
  }

  return formattedText;
}
