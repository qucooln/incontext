import { getSettings } from "./config.js";
import { streamChat, generateSearchQuery } from "./llm.js";
import { multiSearch, formatSearchResults, buildSourcesMarkdown, hasAnySearchKey } from "./search.js";
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
const runs = new Map(); // tabId -> AbortController（每个 tab 各自的在跑请求）
const runStatus = new Map(); // tabId -> 当前阶段文字（供切回时显示）
let searchOn = false; // 「联网」开关
let searchAvailable = false; // 是否配了搜索 key

function isBusy(tabId) {
  return runs.has(tabId);
}
function refreshSendState() {
  $send.disabled = isBusy(currentTabId);
}

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

// 后台运行中的占位气泡（切回还在跑的 tab 时显示当前阶段）
function appendStatusBubble(text) {
  const b = addBubble("assistant");
  b.classList.add("ic-cursor");
  b.textContent = text || "⏳ 正在生成…";
  return b;
}

// 设置某个 run 的当前阶段：记到 runStatus，若正在看该 tab 则更新气泡
function setPhase(tabId, bubble, text) {
  runStatus.set(tabId, text);
  if (tabId === currentTabId) bubble.textContent = text;
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
async function persistTab(tabId, payload, messages) {
  if (tabId == null) return;
  const { conversations = {} } = await chrome.storage.session.get("conversations");
  conversations[tabId] = { payload, messages };
  await chrome.storage.session.set({ conversations });
}
async function persist() {
  await persistTab(currentTabId, currentPayload, conversation);
}

async function clearPending(tabId) {
  const { pendingSelections = {} } = await chrome.storage.session.get("pendingSelections");
  if (tabId in pendingSelections) {
    delete pendingSelections[tabId];
    await chrome.storage.session.set({ pendingSelections });
  }
}

// ---------- 流式（按 tab 的后台任务：切 tab 不打断，跑完存进发起它的 tab）----------
// tabId: 发起本次解释的 tab；convo: 该 tab 的消息数组；payload: 该 tab 的选区；queryCtx 用于联网检索词
async function runStream(tabId, payload, convo, queryCtx) {
  // 同一 tab 上若有旧请求（如刚来新选区），打断它；不同 tab 互不影响
  if (runs.has(tabId)) runs.get(tabId).abort();
  const controller = new AbortController();
  runs.set(tabId, controller);
  const signal = controller.signal;
  refreshSendState();

  const viewing = () => tabId === currentTabId; // 当前是否正显示这个 tab
  const useSearch = searchOn && !!(queryCtx && (queryCtx.question || queryCtx.selection));
  const bubble = addBubble("assistant");
  bubble.classList.add("ic-cursor");
  let acc = "";
  try {
    const settings = await getSettings();

    let extraContext = "";
    let results = [];
    if (useSearch) {
      try {
        setPhase(tabId, bubble, "🔎 正在理解上下文、生成检索词…");
        let sq;
        try {
          sq = await generateSearchQuery(queryCtx, settings);
        } catch {
          sq = [queryCtx.question || queryCtx.selection].filter(Boolean);
        }
        if (signal.aborted) { bubble.remove(); return; }
        if (sq === null || (Array.isArray(sq) && !sq.length)) {
          if (viewing()) {
            const note = document.createElement("div");
            note.style.cssText = "color:#9ca3af;font-size:12px;margin:0 12px 8px;";
            note.textContent = "ℹ 本段判断无需联网，基于全文解释";
            $messages.insertBefore(note, bubble.parentElement);
          }
          bubble.textContent = "";
        } else {
          setPhase(tabId, bubble, "🔍 联网检索：" + sq.join("  ·  "));
          results = await multiSearch(sq, settings);
          extraContext = formatSearchResults(results);
          setPhase(tabId, bubble, "✍️ 结合资料生成中…");
        }
      } catch (e) {
        if (viewing()) {
          const warn = document.createElement("div");
          warn.style.cssText = "color:#b45309;font-size:12px;margin:0 12px 8px;white-space:pre-wrap;";
          warn.textContent = "⚠ 联网搜索失败：" + (e.message || e) + "\n（本次仅基于全文回答）";
          $messages.insertBefore(warn, bubble.parentElement);
        }
        bubble.textContent = "";
      }
      if (signal.aborted) { bubble.remove(); return; }
    }

    await streamChat({
      messages: convo,
      settings,
      signal,
      extraContext,
      onDelta: (_d, full) => {
        if (signal.aborted) return;
        if (runStatus.has(tabId)) runStatus.delete(tabId); // 开始出字，阶段提示结束
        acc = full;
        bubble.innerHTML = renderMarkdown(full);
        if (viewing()) $messages.scrollTop = $messages.scrollHeight;
      },
    });
    if (results.length && acc) {
      acc += buildSourcesMarkdown(results);
      bubble.innerHTML = renderMarkdown(acc);
    }
    bubble.classList.remove("ic-cursor");
    // 无论现在显示哪个 tab，结果都存回发起它的 tab
    convo.push({ role: "assistant", content: acc });
    await persistTab(tabId, payload, convo);
    // 若用户此刻正看着这个 tab（含中途切走又切回），重渲染以确保看到完整结果
    if (viewing()) {
      currentPayload = payload;
      conversation = convo;
      renderConversation();
    }
  } catch (e) {
    bubble.classList.remove("ic-cursor");
    if (e.name === "AbortError") bubble.remove();
    else bubble.innerHTML = `<span class="ic-error">出错了：${e.message}</span>`;
  } finally {
    if (runs.get(tabId) === controller) {
      runs.delete(tabId);
      runStatus.delete(tabId);
    }
    refreshSendState();
  }
}

// 对某个新选区开始一段全新解释（覆盖该 tab 内的旧对话）。
async function startExplain(payload) {
  const tabId = currentTabId;
  currentPayload = payload;
  clearMessages();
  showSelectionHeader();
  const settings = await getSettings();
  conversation = buildInitialMessages(payload, settings);
  await persistTab(tabId, payload, conversation);
  // 后台跑，不 await：切 tab 也不影响它跑完
  runStream(tabId, payload, conversation, {
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
    // 该 tab 还在后台跑（切回时答案尚未生成完）→ 显示进度占位，别空着
    if (runs.has(tabId)) appendStatusBubble(runStatus.get(tabId));
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
  // 切 tab 只切换显示，不打断其它 tab 正在跑的请求
  await loadTab(tabId);
  refreshSendState();
}

// ---------- 追问 ----------
async function sendFollowUp() {
  const text = $input.value.trim();
  if (!text || isBusy(currentTabId)) return;
  const tabId = currentTabId;
  if (!conversation.length) {
    conversation = [{ role: "system", content: "你是一个乐于助人的阅读助手。" }];
  }
  $input.value = "";
  $input.style.height = "auto";
  const b = addBubble("user");
  b.textContent = text;
  conversation.push({ role: "user", content: text });
  const convo = conversation;
  const payload = currentPayload;
  await persistTab(tabId, payload, convo);
  runStream(tabId, payload, convo, {
    selection: payload?.selection || "",
    title: payload?.title || "",
    before: payload?.before || "",
    after: payload?.after || "",
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
    // 多窗口(双屏)：只处理属于本侧栏所在窗口的选区，否则会串屏
    if (myWindowId != null && msg.windowId != null && msg.windowId !== myWindowId) return;
    // 切到该 tab 显示并开新解释；同 tab 的旧请求由 runStream 内部按 tab 打断
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
