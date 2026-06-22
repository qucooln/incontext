// 联网搜索：借智谱独立 web_search API，只取原始资料（不让 GLM 写答案）。
// 拿到的资料注入给主模型(DeepSeek)，由它结合全文生成最终解释——GLM 仅当搜索引擎。

export async function webSearch(query, settings) {
  if (!settings.searchApiKey) {
    throw new Error("联网需要在设置里填「联网搜索 GLM Key」（智谱 key）");
  }
  const url = settings.searchBaseURL.replace(/\/$/, "") + "/web_search";
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + settings.searchApiKey,
    },
    body: JSON.stringify({ search_engine: "search_std", search_query: query.slice(0, 200) }),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`搜索 API ${resp.status}: ${t.slice(0, 200)}`);
  }
  const d = await resp.json();
  return d.search_result || d.data || [];
}

// 把搜索结果整理成喂给主模型的资料块。
export function formatSearchResults(results) {
  if (!results || !results.length) return "";
  const lines = results.slice(0, 8).map((r, i) => {
    const parts = [`[${i + 1}] ${r.title || ""}`];
    if (r.content) parts.push((r.content || "").slice(0, 300));
    if (r.link) parts.push("来源: " + r.link);
    return parts.join("\n");
  });
  return (
    "以下是刚刚联网搜索到的实时资料（请结合整篇文章与这些资料作答，注意时效性，" +
    "如引用请标注其中信息）：\n\n" +
    lines.join("\n\n")
  );
}
