// Content script：监听划词 → 浮出"解释"按钮 → 抽取全文+选区上下文 → 交给 background。
// Readability 由 manifest 在本脚本之前注入，可用全局 Readability。

(() => {
  let btn = null;
  let lastSelectionText = "";

  function removeBtn() {
    if (btn) {
      btn.remove();
      btn = null;
    }
  }

  function getContextAround(range, chars = 300) {
    // 取选区前后的纯文本，帮助模型定位（不是全文，全文另抽）。
    let before = "";
    let after = "";
    try {
      const preRange = range.cloneRange();
      preRange.collapse(true);
      preRange.setStart(document.body, 0);
      before = preRange.toString().slice(-chars);

      const postRange = range.cloneRange();
      postRange.collapse(false);
      postRange.setEnd(document.body, document.body.childNodes.length);
      after = postRange.toString().slice(0, chars);
    } catch {
      // 某些页面 range 操作会抛错，忽略即可
    }
    return { before, after };
  }

  function extractArticle() {
    // 用 Readability 抽正文。克隆 document，避免改动页面。
    try {
      const docClone = document.cloneNode(true);
      const reader = new Readability(docClone);
      const parsed = reader.parse();
      if (parsed && parsed.textContent && parsed.textContent.trim().length > 200) {
        return { article: parsed.textContent.trim(), title: parsed.title || document.title };
      }
    } catch {
      // 抽取失败兜底
    }
    // 兜底：取 body 可见文本
    return { article: (document.body?.innerText || "").trim(), title: document.title };
  }

  function buildPayload(selectionText, range) {
    const { before, after } = getContextAround(range);
    const { article, title } = extractArticle();
    return {
      selection: selectionText,
      before,
      after,
      article,
      title,
      url: location.href,
      ts: Date.now(),
    };
  }

  function sendExplain(selectionText, range) {
    const payload = buildPayload(selectionText, range);
    chrome.runtime.sendMessage({ type: "EXPLAIN", payload });
    removeBtn();
  }

  function showButton(x, y, selectionText, range) {
    removeBtn();
    btn = document.createElement("div");
    btn.className = "incontext-explain-btn";
    btn.textContent = "解释";
    btn.style.left = `${x}px`;
    btn.style.top = `${y}px`;
    btn.addEventListener("mousedown", (e) => {
      // mousedown 防止点击前选区被清空
      e.preventDefault();
      e.stopPropagation();
      sendExplain(selectionText, range);
    });
    document.body.appendChild(btn);
  }

  document.addEventListener("mouseup", (e) => {
    if (btn && btn.contains(e.target)) return;
    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : "";
      if (!text || text.length < 2) {
        removeBtn();
        return;
      }
      lastSelectionText = text;
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const x = window.scrollX + rect.left + rect.width / 2 - 24;
      const y = window.scrollY + rect.bottom + 8;
      showButton(x, y, text, range);
    }, 10);
  });

  document.addEventListener("mousedown", (e) => {
    if (btn && !btn.contains(e.target)) removeBtn();
  });
  document.addEventListener("scroll", removeBtn, { passive: true });

  // 快捷键 / 右键菜单触发：直接拿当前选区。
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === "TRIGGER_EXPLAIN") {
      const sel = window.getSelection();
      const text = sel ? sel.toString().trim() : lastSelectionText;
      if (text && text.length >= 2) {
        const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
        const payload = range
          ? buildPayload(text, range)
          : { selection: text, before: "", after: "", ...extractArticle(), url: location.href, ts: Date.now() };
        chrome.runtime.sendMessage({ type: "EXPLAIN", payload });
        sendResponse({ ok: true });
      } else {
        sendResponse({ ok: false, reason: "no-selection" });
      }
    }
    return true;
  });
})();
