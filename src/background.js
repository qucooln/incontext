// Background service worker：选区数据中转 + 打开侧栏 + 右键菜单/快捷键触发。
// 状态按 tabId 存：每个标签页各自一份待解释选区(pendingSelections)与对话(conversations)。
// 关键：sidePanel.open() 必须在用户手势的同步调用栈里执行。

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

// 把某个 tab 的新选区写入待处理区，并通知侧栏（带 tabId + windowId）。
// windowId 用于多窗口(双屏)场景：让选区只被它所在窗口的侧栏处理。
async function setPending(tabId, windowId, payload) {
  const { pendingSelections = {} } = await chrome.storage.session.get("pendingSelections");
  pendingSelections[tabId] = payload;
  await chrome.storage.session.set({ pendingSelections });
  chrome.runtime.sendMessage({ type: "NEW_SELECTION", tabId, windowId, payload }).catch(() => {});
}

// 让内容脚本抽全文；抽不到（file:// 未授权、内容脚本未注入）则用兜底文本。
function gatherAndExplain(tabId, windowId, fallbackSelection, pageUrl) {
  chrome.tabs.sendMessage(tabId, { type: "TRIGGER_EXPLAIN" }, (resp) => {
    if (chrome.runtime.lastError || !resp?.ok) {
      if (fallbackSelection && fallbackSelection.trim()) {
        setPending(tabId, windowId, {
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
  return chrome.sidePanel.open({ tabId }).catch(() => {}); // 必须同步调用以保留用户手势
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "EXPLAIN" && msg.payload) {
    const tabId = sender.tab?.id;
    if (tabId != null) {
      openPanel(tabId);
      setPending(tabId, sender.tab?.windowId, msg.payload);
    }
    sendResponse?.({ ok: true });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "incontext-explain" || tab?.id == null) return;
  openPanel(tab.id);
  gatherAndExplain(tab.id, tab.windowId, info.selectionText, info.pageUrl);
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command !== "explain-selection" || tab?.id == null) return;
  openPanel(tab.id);
  gatherAndExplain(tab.id, tab.windowId, "", tab.url);
});

// tab 关闭时清理它的选区与对话，避免 storage 堆积。
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { conversations = {}, pendingSelections = {} } = await chrome.storage.session.get([
    "conversations",
    "pendingSelections",
  ]);
  if (tabId in conversations || tabId in pendingSelections) {
    delete conversations[tabId];
    delete pendingSelections[tabId];
    await chrome.storage.session.set({ conversations, pendingSelections });
  }
});
