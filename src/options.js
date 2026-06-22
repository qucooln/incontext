import { PROVIDERS, getSettings, saveSettings, DEFAULT_SETTINGS } from "./config.js";

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
el("provider").addEventListener("change", (e) => {
  const p = PROVIDERS[e.target.value];
  if (p && e.target.value !== "custom") {
    el("baseURL").value = p.baseURL;
    el("model").value = p.defaultModel;
  }
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

async function load() {
  const s = await getSettings();
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
  await saveSettings({
    provider: el("provider").value,
    baseURL: el("baseURL").value.trim() || DEFAULT_SETTINGS.baseURL,
    model: el("model").value.trim() || DEFAULT_SETTINGS.model,
    apiKey: el("apiKey").value.trim(),
    targetLang: el("targetLang").value.trim() || "中文",
    maxArticleChars: parseInt(el("maxArticleChars").value, 10) || DEFAULT_SETTINGS.maxArticleChars,
    useMock: el("useMock").checked,
    searchEnabled: el("searchEnabled").checked,
    searchProvider: checked ? checked.value : DEFAULT_SETTINGS.searchProvider,
    serperApiKey: el("serperApiKey").value.trim(),
    serpapiApiKey: el("serpapiApiKey").value.trim(),
    tavilyApiKey: el("tavilyApiKey").value.trim(),
  });
  el("status").textContent = "已保存 ✓";
  setTimeout(() => (el("status").textContent = ""), 2000);
});

load();
