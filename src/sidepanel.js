import { getSettings } from "./config.js";
import { streamChat, generateSearchQuery } from "./llm.js";
import { webSearch, formatSearchResults, buildSourcesMarkdown, hasAnySearchKey } from "./search.js";
import { buildInitialMessages } from "./prompt.js";
import { renderMarkdown } from "./markdown.js";

const $messages = document.getElementById("ic-messages");
const $selection = document.getElementById("ic-selection");
const $input = document.getElementById("ic-input");
const $send = document.getElementById("ic-send");
const $settings = document.getElementById("ic-settings");
const $searchToggle = document.getElementById("ic-search-toggle");

const EMPTY_HTML = `<div class="ic-empty">
  <p>在网页上划选一段文字，点击浮出的「解释」按钮，<br />我会结合整篇文章来解释它。</p>
  <p class="ic-hint">也可右键菜单 / 快捷键 <kbd>Ctrl+Shift+E</kbd> 触发。</p>
</div>`;

let myWindowId = null;
let currentTabId = null;
let conversation = []; // { role, content }[] 含 system，对应 currentTabId
let currentPayload = null;
let abortController = null;
let busy = false;
let searchOn = false; // 「联网」开关
let searchAvailable = false; // 是否配了搜索 key

$settings.addEventListener("click", () => chrome.runtime.openOptionsPage());
$searchToggle.addEventListener("click", () => {
  if (!searchAvailable) {
    chrome.runtime.openOptionsPage(); // 没 key，引导去设置
    return;
  }
  searchOn = !searchOn;
  $searchToggle.classList.toggle("on", searchOn);
});

// ---------- 渲染 ----------
function clearMessages() {
  $messages.innerHTML = "";
}

function showEmpty() {
  conversation = [];
  currentPayload = null;
  $selection.hidden = true;
  $messages.innerHTML = EMPTY_HTML;
}

function addBubble(role) {
  const wrap = document.createElement("div");
  wrap.className = `ic-msg ${role}`;
  const label = document.createElement("div");
  label.className = "ic-role";
  label.textContent = role === "user" ? "你" : "InContext";
  const bubble = document.createElement("div");
  bubble.className = "ic-bubble";
  wrap.appendChild(label);
  wrap.appendChild(bubble);
  $messages.appendChild(wrap);
  $messages.scrollTop = $messages.scrollHeight;
  return bubble;
}

function showSelectionHeader() {
  if (!currentPayload) return;
  $selection.hidden = false;
  $selection.textContent = currentPayload.selection;
  if (currentPayload.note) {
    const n = document.createElement("div");
    n.style.cssText = "color:#b45309;font-size:12px;margin:6px 12px 0;";
    n.textContent = "⚠ " + currentPayload.note;
    $messages.appendChild(n);
  }
}

// 从存储的 conversation 重建整段对话（跳过 system 与首条选区提示）。
function renderConversation() {
  clearMessages();
  showSelectionHeader();
  let skippedFirstUser = false;
  for (const m of conversation) {
    if (m.role === "system") continue;
    if (m.role === "user" && !skippedFirstUser) {
      skippedFirstUser = true; // 首条 user = 选区提示，不单独显示
      continue;
    }
    const b = addBubble(m.role);
    if (m.role === "assistant") b.innerHTML = renderMarkdown(m.content);
    else b.textContent = m.content;
  }
  $messages.scrollTop = $messages.scrollHeight;
}

// ---------- 持久化（按 tab） ----------
async function persist() {
  if (currentTabId == null) return;
  const { conversations = {} } = await chrome.storage.session.get("conversations");
  conversations[currentTabId] = { payload: currentPayload, messages: conversation };
  await chrome.storage.session.set({ conversations });
}

async function clearPending(tabId) {
  const { pendingSelections = {} } = await chrome.storage.session.get("pendingSelections");
  if (tabId in pendingSelections) {
    delete pendingSelections[tabId];
    await chrome.storage.session.set({ pendingSelections });
  }
}

// ---------- 流式 ----------
// queryCtx: { selection, title, before, after, question }（用于联网时生成检索词）
async function runStream(queryCtx) {
  busy = true;
  $send.disabled = true;
  if (abortController) abortController.abort();
  abortController = new AbortController();
  const signal = abortController.signal;
  const tabAtStart = currentTabId;

  const useSearch = searchOn && !!(queryCtx && (queryCtx.question || queryCtx.selection));
  const bubble = addBubble("assistant");
  bubble.classList.add("ic-cursor");
  let acc = "";
  try {
    const settings = await getSettings();

    // 联网：先理解上下文生成精准检索词 → 搜索 → 资料作为临时上下文喂给主模型（DeepSeek）。
    let extraContext = "";
    let results = [];
    if (useSearch) {
      try {
        bubble.textContent = "🔎 正在理解上下文、生成检索词…";
        let sq;
        try {
          sq = await generateSearchQuery(queryCtx, settings);
        } catch {
          sq = queryCtx.question || queryCtx.selection; // 生成失败回退原文
        }
        if (sq === null) {
          // 模型判断无需联网，直接基于全文答；给个轻提示避免疑惑
          const note = document.createElement("div");
          note.style.cssText = "color:#9ca3af;font-size:12px;margin:0 12px 8px;";
          note.textContent = "ℹ 本段判断无需联网，基于全文解释";
          $messages.insertBefore(note, bubble.parentElement);
          bubble.textContent = "";
        } else {
          bubble.textContent = "🔍 联网检索：" + sq;
          results = await webSearch(sq, settings);
          extraContext = formatSearchResults(results);
          bubble.textContent = "✍️ 结合资料生成中…";
        }
      } catch (e) {
        const warn = document.createElement("div");
        warn.style.cssText = "color:#b45309;font-size:12px;margin:0 12px 8px;white-space:pre-wrap;";
        warn.textContent = "⚠ 联网搜索失败：" + (e.message || e) + "\n（本次仅基于全文回答）";
        $messages.insertBefore(warn, bubble.parentElement);
        bubble.textContent = "";
      }
      if (signal.aborted) { bubble.remove(); busy = false; $send.disabled = false; return; }
    }

    await streamChat({
      messages: conversation,
      settings,
      signal,
      extraContext,
      onDelta: (_d, full) => {
        if (signal.aborted) return;
        acc = full;
        bubble.innerHTML = renderMarkdown(full);
        $messages.scrollTop = $messages.scrollHeight;
      },
    });
    // 联网时把「来源」清单附在答案末尾（模型正文用 [n] 标注，这里对应编号给出链接）
    if (results.length && acc) {
      acc += buildSourcesMarkdown(results);
      bubble.innerHTML = renderMarkdown(acc);
    }
    bubble.classList.remove("ic-cursor");
    if (tabAtStart === currentTabId) {
      conversation.push({ role: "assistant", content: acc });
      await persist();
    }
  } catch (e) {
    bubble.classList.remove("ic-cursor");
    if (e.name === "AbortError") bubble.remove();
    else bubble.innerHTML = `<span class="ic-error">出错了：${e.message}</span>`;
  } finally {
    busy = false;
    $send.disabled = false;
  }
}

// 对某个新选区开始一段全新解释（覆盖该 tab 内的旧对话）。
async function startExplain(payload) {
  currentPayload = payload;
  clearMessages();
  showSelectionHeader();
  const settings = await getSettings();
  conversation = buildInitialMessages(payload, settings);
  await persist();
  await runStream({
    selection: payload.selection,
    title: payload.title,
    before: payload.before,
    after: payload.after,
    question: "",
  });
}

// ---------- tab 切换 ----------
async function loadTab(tabId) {
  currentTabId = tabId;
  const { conversations = {}, pendingSelections = {} } = await chrome.storage.session.get([
    "conversations",
    "pendingSelections",
  ]);
  const pending = pendingSelections[tabId];
  const conv = conversations[tabId];
  if (pending) {
    await clearPending(tabId);
    await startExplain(pending);
  } else if (conv && conv.messages?.length) {
    currentPayload = conv.payload;
    conversation = conv.messages;
    renderConversation();
  } else {
    showEmpty();
  }
}

async function switchToTab(tabId) {
  if (tabId === currentTabId) {
    // 同一 tab 内来了新选区（pending）也要刷新
    const { pendingSelections = {} } = await chrome.storage.session.get("pendingSelections");
    if (pendingSelections[tabId]) {
      const p = pendingSelections[tabId];
      await clearPending(tabId);
      await startExplain(p);
    }
    return;
  }
  if (abortController) abortController.abort();
  await loadTab(tabId);
}

// ---------- 追问 ----------
async function sendFollowUp() {
  const text = $input.value.trim();
  if (!text || busy) return;
  if (!conversation.length) {
    conversation = [{ role: "system", content: "你是一个乐于助人的阅读助手。" }];
  }
  $input.value = "";
  $input.style.height = "auto";
  const b = addBubble("user");
  b.textContent = text;
  conversation.push({ role: "user", content: text });
  await persist();
  await runStream({
    selection: currentPayload?.selection || "",
    title: currentPayload?.title || "",
    before: currentPayload?.before || "",
    after: currentPayload?.after || "",
    question: text,
  });
}

$send.addEventListener("click", sendFollowUp);
$input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendFollowUp();
  }
});
$input.addEventListener("input", () => {
  $input.style.height = "auto";
  $input.style.height = Math.min($input.scrollHeight, 120) + "px";
});

// 新选区通知：选区一定来自用户正在操作的 tab，直接信任并切到它（避免 getCurrent 判错导致静默丢弃）。
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "NEW_SELECTION" && msg.tabId != null) {
    if (busy && abortController) abortController.abort();
    currentTabId = msg.tabId;
    clearPending(msg.tabId);
    startExplain(msg.payload);
  }
});

// 切换激活 tab / 窗口焦点 → 跟随
chrome.tabs.onActivated.addListener((info) => {
  if (myWindowId != null && info.windowId !== myWindowId) return;
  switchToTab(info.tabId);
});
chrome.windows.onFocusChanged.addListener(async (winId) => {
  if (myWindowId == null || winId !== myWindowId) return;
  const [tab] = await chrome.tabs.query({ active: true, windowId: myWindowId });
  if (tab) switchToTab(tab.id);
});

// 启动：定位当前窗口的激活 tab，加载它的状态
(async () => {
  const settings = await getSettings();
  searchAvailable = hasAnySearchKey(settings);
  searchOn = searchAvailable && !!settings.searchEnabled;
  $searchToggle.classList.toggle("on", searchOn);
  $searchToggle.classList.toggle("disabled", !searchAvailable);
  $searchToggle.title = searchAvailable ? "开启后联网搜索回答" : "未配置搜索 key，点此去设置";
  const win = await chrome.windows.getCurrent();
  myWindowId = win.id;
  const [tab] = await chrome.tabs.query({ active: true, windowId: myWindowId });
  if (tab) await loadTab(tab.id);
  else showEmpty();
})();
