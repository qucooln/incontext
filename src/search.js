// 联网搜索：可插拔多引擎。统一归一化为 { title, link, content, media }。
// 拿到的资料注入给主模型(DeepSeek)，由它结合全文生成最终解释并标注来源。

async function searchSerper(query, settings) {
  // 真·Google 结果（google.serper.dev）。需外网。
  const resp = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": settings.searchApiKey },
    body: JSON.stringify({ q: query, hl: "zh-cn", num: 10 }),
  });
  if (!resp.ok) throw new Error(`Serper ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const d = await resp.json();
  return (d.organic || []).map((r) => ({
    title: r.title,
    link: r.link,
    content: r.snippet || "",
    media: r.link ? new URL(r.link).hostname.replace(/^www\./, "") : "",
  }));
}

async function searchTavily(query, settings) {
  // 专为 LLM 优化的搜索（api.tavily.com）。需外网。
  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: settings.searchApiKey,
      query,
      max_results: 8,
      search_depth: "basic",
    }),
  });
  if (!resp.ok) throw new Error(`Tavily ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const d = await resp.json();
  return (d.results || []).map((r) => ({
    title: r.title,
    link: r.url,
    content: r.content || "",
    media: r.url ? new URL(r.url).hostname.replace(/^www\./, "") : "",
  }));
}

async function searchBocha(query, settings) {
  // 博查（api.bochaai.com）。国内可直连，中文友好。
  const resp = await fetch("https://api.bochaai.com/v1/web-search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + settings.searchApiKey,
    },
    body: JSON.stringify({ query, summary: true, count: 10 }),
  });
  if (!resp.ok) throw new Error(`博查 ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const d = await resp.json();
  const items = d.data?.webPages?.value || [];
  return items.map((r) => ({
    title: r.name,
    link: r.url,
    content: r.summary || r.snippet || "",
    media: r.siteName || (r.url ? new URL(r.url).hostname.replace(/^www\./, "") : ""),
  }));
}

async function searchZhipu(query, settings) {
  // 智谱独立 web_search（兜底/国内）。
  const url = settings.searchBaseURL.replace(/\/$/, "") + "/web_search";
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + settings.searchApiKey,
    },
    body: JSON.stringify({ search_engine: "search_std", search_query: query.slice(0, 200) }),
  });
  if (!resp.ok) throw new Error(`智谱 ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const d = await resp.json();
  return (d.search_result || []).map((r) => ({
    title: r.title,
    link: r.link || "",
    content: r.content || "",
    media: r.media || "",
  }));
}

const PROVIDERS = {
  serper: searchSerper,
  tavily: searchTavily,
  bocha: searchBocha,
  zhipu: searchZhipu,
};

export async function webSearch(query, settings) {
  if (!settings.searchApiKey) {
    throw new Error("联网需要在设置里选择搜索引擎并填对应的 API Key");
  }
  const fn = PROVIDERS[settings.searchProvider] || searchSerper;
  return fn(query, settings);
}

// 喂给主模型的资料块（带编号，强制要求模型在引用处标注 [n]）。
export function formatSearchResults(results) {
  if (!results || !results.length) return "";
  const lines = results.slice(0, 8).map((r, i) => {
    const parts = [`[${i + 1}] ${r.title || ""}`];
    if (r.content) parts.push((r.content || "").slice(0, 400));
    if (r.link) parts.push("链接: " + r.link);
    return parts.join("\n");
  });
  return (
    "以下是刚刚联网搜索到的实时资料，每条带编号 [n]：\n\n" +
    lines.join("\n\n") +
    "\n\n【强制引用规则，必须遵守】\n" +
    "1) 凡是用到上面任意一条联网资料的信息，必须在该句末尾用半角方括号标注编号，如 [1] 或 [2][3]；\n" +
    "2) 至少标注一处（只要你引用了联网资料）；仅凭文章本身或常识的内容不要标注；\n" +
    "3) 不要在正文里自己写“来源”列表（系统会自动附上）。\n" +
    "示例：谢赛宁主张模型走向真实世界数据 [1]，这与其 AMI 的联盟模式一致 [3]。"
  );
}

// 答案末尾的「来源」清单：编号对应正文里的 [n]。
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
