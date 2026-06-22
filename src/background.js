// Background service worker：选区数据中转 + 打开侧栏 + 右键菜单/快捷键触发。
// 关键：sidePanel.open() 必须在用户手势的同步调用栈里执行，所以在
// contextMenu / command 处理器的第一时间就 open，再去抽全文。

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "incontext-explain",
      title: '用 InContext 解释 "%s"',
      contexts: ["selection"],
    });
  });
  chrome.sidePanel
    ?.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
});

async function storeAndBroadcast(payload) {
  await chrome.storage.session.set({ currentPayload: payload });
  chrome.runtime.sendMessage({ type: "NEW_SELECTION", payload }).catch(() => {});
}

// 让内容脚本抽全文；抽不到（如 file:// 未授权、内容脚本未注入）则用兜底文本。
function gatherAndExplain(tabId, fallbackSelection, pageUrl) {
  chrome.tabs.sendMessage(tabId, { type: "TRIGGER_EXPLAIN" }, (resp) => {
    if (chrome.runtime.lastError || !resp?.ok) {
      if (fallbackSelection && fallbackSelection.trim()) {
        storeAndBroadcast({
          selection: fallbackSelection.trim(),
          before: "", after: "", article: "", title: "",
          url: pageUrl || "", ts: Date.now(),
          note: "未能注入页面脚本（可能是本地文件或受限页面），本次仅基于选中段解释，未结合全文。",
        });
      }
    }
    // 若 resp.ok，内容脚本已自行发回 EXPLAIN，由下方监听处理
  });
}

function openPanel(tabId) {
  // 必须同步调用以保留用户手势
  return chrome.sidePanel.open({ tabId }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "EXPLAIN" && msg.payload) {
    // 来自划词浮按钮：侧栏若已开则直接刷新；尝试 open（手势可能已丢，失败则需先开侧栏）
    const tabId = sender.tab?.id;
    if (tabId != null) openPanel(tabId);
    storeAndBroadcast(msg.payload);
    sendResponse?.({ ok: true });
  }
  if (msg.type === "GET_PAYLOAD") {
    chrome.storage.session.get("currentPayload").then((r) => {
      sendResponse({ payload: r.currentPayload || null });
    });
    return true; // async
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "incontext-explain" || tab?.id == null) return;
  openPanel(tab.id); // 手势内同步开侧栏
  gatherAndExplain(tab.id, info.selectionText, info.pageUrl);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "explain-selection" || tab?.id == null) return;
  openPanel(tab.id); // 手势内同步开侧栏
  gatherAndExplain(tab.id, "", tab.url);
});
