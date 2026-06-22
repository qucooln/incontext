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

// 把搜索结果整理成喂给主模型的资料块（带编号，要求模型在引用处标注 [n]）。
export function formatSearchResults(results) {
  if (!results || !results.length) return "";
  const lines = results.slice(0, 8).map((r, i) => {
    const parts = [`[${i + 1}] ${r.title || ""}`];
    if (r.content) parts.push((r.content || "").slice(0, 300));
    if (r.link) parts.push("链接: " + r.link);
    return parts.join("\n");
  });
  return (
    "以下是刚刚联网搜索到的实时资料，每条带编号 [n]：\n\n" +
    lines.join("\n\n") +
    "\n\n【引用要求】请结合整篇文章与这些资料作答；凡是用到上面某条联网资料的信息，" +
    "务必在该处句末用方括号编号标注来源，例如 [1] 或 [2][3]。仅凭文章本身或常识得出的内容不要标注。" +
    "不要在正文里另写“来源”列表（系统会自动附上）。"
  );
}

// 答案末尾的「来源」清单：编号对应正文里的 [n]，给出标题/媒体/可点链接。
export function buildSourcesMarkdown(results) {
  if (!results || !results.length) return "";
  const items = results.slice(0, 8).map((r, i) => {
    const n = i + 1;
    const title = r.title || "(无标题)";
    const media = r.media ? ` · ${r.media}` : "";
    return r.link ? `${n}. [${title}](${r.link})${media}` : `${n}. ${title}${media}`;
  });
  return "\n\n---\n**来源（联网）**\n" + items.join("\n");
}
