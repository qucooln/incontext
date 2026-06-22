import { getSettings } from "./config.js";
import { streamChat } from "./llm.js";
import { buildInitialMessages } from "./prompt.js";
import { renderMarkdown } from "./markdown.js";

const $messages = document.getElementById("ic-messages");
const $selection = document.getElementById("ic-selection");
const $input = document.getElementById("ic-input");
const $send = document.getElementById("ic-send");
const $settings = document.getElementById("ic-settings");

let conversation = []; // { role, content }[]  含 system
let currentPayload = null;
let abortController = null;
let busy = false;

$settings.addEventListener("click", () => chrome.runtime.openOptionsPage());

function clearMessages() {
  $messages.innerHTML = "";
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

function setUserBubble(text) {
  const b = addBubble("user");
  b.textContent = text;
}

async function runStream(messagesForApi) {
  busy = true;
  $send.disabled = true;
  if (abortController) abortController.abort();
  abortController = new AbortController();

  const bubble = addBubble("assistant");
  bubble.classList.add("ic-cursor");
  let acc = "";

  try {
    const settings = await getSettings();
    await streamChat({
      messages: messagesForApi,
      settings,
      signal: abortController.signal,
      onDelta: (_delta, full) => {
        acc = full;
        bubble.innerHTML = renderMarkdown(full);
        $messages.scrollTop = $messages.scrollHeight;
      },
    });
    bubble.classList.remove("ic-cursor");
    conversation.push({ role: "assistant", content: acc });
  } catch (e) {
    bubble.classList.remove("ic-cursor");
    if (e.name === "AbortError") {
      bubble.remove();
    } else {
      bubble.innerHTML = `<span class="ic-error">出错了：${e.message}</span>`;
    }
  } finally {
    busy = false;
    $send.disabled = false;
  }
}

async function startExplain(payload) {
  currentPayload = payload;
  clearMessages();
  $selection.hidden = false;
  $selection.textContent = payload.selection;

  const settings = await getSettings();
  conversation = buildInitialMessages(payload, settings);
  await runStream(conversation);
}

async function sendFollowUp() {
  const text = $input.value.trim();
  if (!text || busy) return;
  if (!conversation.length) {
    // 还没有划词上下文，作为普通对话起头
    conversation = [
      { role: "system", content: "你是一个乐于助人的阅读助手。" },
    ];
  }
  $input.value = "";
  $input.style.height = "auto";
  setUserBubble(text);
  conversation.push({ role: "user", content: text });
  await runStream(conversation);
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

// 收到新选区（侧栏已开着时）
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "NEW_SELECTION" && msg.payload) {
    startExplain(msg.payload);
  }
});

// 侧栏首次加载：主动取一次当前选区
(async () => {
  const resp = await chrome.runtime.sendMessage({ type: "GET_PAYLOAD" }).catch(() => null);
  if (resp?.payload) startExplain(resp.payload);
})();
