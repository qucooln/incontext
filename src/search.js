// 联网搜索：Serper（真 Google）与 Tavily 两家。统一归一化为 { title, link, content, media }。
// 拿到的资料注入给主模型(DeepSeek)，由它结合全文生成最终解释并标注来源。

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function searchSerper(query, key) {
  const resp = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": key },
    body: JSON.stringify({ q: query, hl: "zh-cn", num: 10 }),
  });
  if (!resp.ok) throw new Error(`Serper ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const d = await resp.json();
  return (d.organic || []).map((r) => ({
    title: r.title,
    link: r.link,
    content: r.snippet || "",
    media: hostOf(r.link),
  }));
}

async function searchSerpapi(query, key) {
  // serpapi.com（注意：与 serper.dev 是两家！）。key 走 query 参数。
  const u = new URL("https://serpapi.com/search.json");
  u.searchParams.set("q", query);
  u.searchParams.set("engine", "google");
  u.searchParams.set("hl", "zh-cn");
  u.searchParams.set("num", "10");
  u.searchParams.set("api_key", key);
  const resp = await fetch(u.toString());
  if (!resp.ok) throw new Error(`SerpAPI ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const d = await resp.json();
  if (d.error) throw new Error("SerpAPI: " + d.error);
  return (d.organic_results || []).map((r) => ({
    title: r.title,
    link: r.link,
    content: r.snippet || "",
    media: r.source || hostOf(r.link),
  }));
}

async function searchTavily(query, key) {
  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, query, max_results: 8, search_depth: "basic" }),
  });
  if (!resp.ok) throw new Error(`Tavily ${resp.status}: ${(await resp.text()).slice(0, 200)}`);
  const d = await resp.json();
  return (d.results || []).map((r) => ({
    title: r.title,
    link: r.url,
    content: r.content || "",
    media: hostOf(r.url),
  }));
}

const PROVIDERS = {
  serper: { label: "Serper（Google）", fn: searchSerper, keyField: "serperApiKey" },
  serpapi: { label: "SerpAPI（Google）", fn: searchSerpapi, keyField: "serpapiApiKey" },
  tavily: { label: "Tavily", fn: searchTavily, keyField: "tavilyApiKey" },
};

export function providerKey(settings, provider) {
  const p = PROVIDERS[provider];
  return p ? settings[p.keyField] || "" : "";
}

// 有没有任何一个搜索引擎配了 key（决定「联网」能否开启）。
export function hasAnySearchKey(settings) {
  return Object.keys(PROVIDERS).some((p) => providerKey(settings, p));
}

// 选一个有 key 的可用引擎：优先用户所选，否则退到任意有 key 的。
export function effectiveProvider(settings) {
  if (providerKey(settings, settings.searchProvider)) return settings.searchProvider;
  return Object.keys(PROVIDERS).find((p) => providerKey(settings, p)) || null;
}

export async function webSearch(query, settings) {
  const provider = effectiveProvider(settings);
  if (!provider) throw new Error("未配置搜索引擎 key，请到设置「搜索」页填 key");
  return PROVIDERS[provider].fn(query, providerKey(settings, provider));
}

// 多查询（中文+英文）并发搜索，合并去重。全部失败才抛错。
export async function multiSearch(queries, settings) {
  const list = (Array.isArray(queries) ? queries : [queries]).filter(Boolean);
  if (!list.length) return [];
  const settled = await Promise.allSettled(list.map((q) => webSearch(q, settings)));
  const ok = settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
  if (!ok.length) {
    const rej = settled.find((s) => s.status === "rejected");
    throw rej ? rej.reason : new Error("搜索无结果");
  }
  const seen = new Set();
  const merged = [];
  for (const arr of ok) {
    for (const r of arr) {
      const k = (r.link || r.title || "").trim();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      merged.push(r);
    }
  }
  return merged.slice(0, 8);
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
