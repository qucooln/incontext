import { PROVIDERS, getSettings, saveSettings, resolveProvider } from "./config.js";
import { streamChat } from "./llm.js";

let cachedSettings = null; // 保存各家 providerConfigs，供切换时带出

const el = (id) => document.getElementById(id);

// ---- tab 切换 ----
document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    el("panel-" + btn.dataset.tab).classList.add("active");
  });
});

// ---- 模型服务商预设 ----
for (const [key, p] of Object.entries(PROVIDERS)) {
  const opt = document.createElement("option");
  opt.value = key;
  opt.textContent = p.label;
  el("provider").appendChild(opt);
}
// 切换服务商：带出该家已存配置（没存过则用预设默认），不丢已填的 key
el("provider").addEventListener("change", (e) => {
  const cfg = resolveProvider(cachedSettings || { providerConfigs: {} }, e.target.value);
  el("baseURL").value = cfg.baseURL;
  el("model").value = cfg.model;
  el("apiKey").value = cfg.apiKey;
  el("test-model-status").textContent = "";
});

// ---- 搜索引擎单选项：填了 key 才能选 ----
const SEARCH_PROVS = ["serper", "serpapi", "tavily"];
function refreshSearchRadios() {
  const map = {
    serper: el("serperApiKey").value.trim(),
    serpapi: el("serpapiApiKey").value.trim(),
    tavily: el("tavilyApiKey").value.trim(),
  };
  for (const prov of SEARCH_PROVS) {
    const radio = el("prov-" + prov);
    const line = el("line-" + prov);
    const enabled = !!map[prov];
    radio.disabled = !enabled;
    line.classList.toggle("disabled", !enabled);
    if (!enabled && radio.checked) radio.checked = false;
  }
  // 若当前没有选中但有可用项，自动选第一个有 key 的
  const checked = document.querySelector('input[name="searchProvider"]:checked');
  if (!checked) {
    const first = SEARCH_PROVS.find((p) => map[p]);
    if (first) el("prov-" + first).checked = true;
  }
}
el("serperApiKey").addEventListener("input", refreshSearchRadios);
el("serpapiApiKey").addEventListener("input", refreshSearchRadios);
el("tavilyApiKey").addEventListener("input", refreshSearchRadios);

// 一键测试当前模型配置能否连通
el("test-model").addEventListener("click", async () => {
  const st = el("test-model-status");
  const settings = {
    provider: el("provider").value,
    baseURL: el("baseURL").value.trim(),
    model: el("model").value.trim(),
    apiKey: el("apiKey").value.trim(),
  };
  if (!settings.apiKey) {
    st.textContent = "请先填 API Key";
    st.style.color = "#dc2626";
    return;
  }
  st.textContent = "测试中…";
  st.style.color = "#6b7280";
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 25000);
  try {
    let got = "";
    await streamChat({
      messages: [{ role: "user", content: "回复两个字：你好" }],
      settings,
      signal: ac.signal,
      onDelta: (_d, f) => (got = f),
    });
    clearTimeout(timer);
    st.textContent = got ? "✓ 连接成功：" + got.slice(0, 20) : "✓ 已连接（无输出）";
    st.style.color = "#16a34a";
  } catch (e) {
    clearTimeout(timer);
    const msg = e.name === "AbortError" ? "超时（25s）" : e.message || String(e);
    st.textContent = "✗ " + msg.slice(0, 140);
    st.style.color = "#dc2626";
  }
});

async function load() {
  const s = await getSettings();
  cachedSettings = s;
  el("provider").value = s.provider;
  el("baseURL").value = s.baseURL;
  el("model").value = s.model;
  el("apiKey").value = s.apiKey;
  el("targetLang").value = s.targetLang;
  el("maxArticleChars").value = s.maxArticleChars;
  el("useMock").checked = s.useMock;

  el("searchEnabled").checked = s.searchEnabled;
  el("serperApiKey").value = s.serperApiKey;
  el("serpapiApiKey").value = s.serpapiApiKey;
  el("tavilyApiKey").value = s.tavilyApiKey;
  const radio = el("prov-" + s.searchProvider);
  if (radio) radio.checked = true;
  refreshSearchRadios();
}

el("save").addEventListener("click", async () => {
  const checked = document.querySelector('input[name="searchProvider"]:checked');
  const p = el("provider").value;
  const preset = PROVIDERS[p] || {};
  await saveSettings({
    provider: p,
    // 只更新当前这家的配置，其它家的 key 原样保留
    providerConfigs: {
      [p]: {
        baseURL: el("baseURL").value.trim() || preset.baseURL || "",
        model: el("model").value.trim() || preset.defaultModel || "",
        apiKey: el("apiKey").value.trim(),
      },
    },
    targetLang: el("targetLang").value.trim() || "中文",
    maxArticleChars: parseInt(el("maxArticleChars").value, 10) || 24000,
    useMock: el("useMock").checked,
    searchEnabled: el("searchEnabled").checked,
    searchProvider: checked ? checked.value : "serper",
    serperApiKey: el("serperApiKey").value.trim(),
    serpapiApiKey: el("serpapiApiKey").value.trim(),
    tavilyApiKey: el("tavilyApiKey").value.trim(),
  });
  cachedSettings = await getSettings(); // 刷新缓存，供后续切换带出
  el("status").textContent = "已保存 ✓";
  setTimeout(() => (el("status").textContent = ""), 2000);
});

load();
