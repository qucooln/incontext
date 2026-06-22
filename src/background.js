// Background service worker：选区数据中转 + 打开侧栏 + 右键菜单/快捷键触发。

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "incontext-explain",
    title: '用 InContext 解释 "%s"',
    contexts: ["selection"],
  });
  // 点击工具栏图标也能打开侧栏
  chrome.sidePanel
    ?.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
});

async function openPanelWithPayload(tabId, payload) {
  // 存到 session，侧栏加载/收到通知后来取
  await chrome.storage.session.set({ currentPayload: payload });
  try {
    if (tabId != null) {
      await chrome.sidePanel.open({ tabId });
    }
  } catch (e) {
    // open 必须在用户手势内，少数情况下会失败；忽略，侧栏下次打开仍能取到 payload
  }
  // 通知已打开的侧栏刷新
  chrome.runtime.sendMessage({ type: "NEW_SELECTION", payload }).catch(() => {});
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "EXPLAIN" && msg.payload) {
    const tabId = sender.tab?.id;
    openPanelWithPayload(tabId, msg.payload);
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
  if (info.menuItemId === "incontext-explain" && tab?.id != null) {
    chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_EXPLAIN" }).catch(() => {});
  }
});

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === "explain-selection" && tab?.id != null) {
    chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_EXPLAIN" }).catch(() => {});
  }
});
