// 核心差异点：把整篇文章注入 system prompt，让模型"结合全文"解释划中的那一段。

function clampArticle(article, maxChars) {
  if (!article) return "";
  if (article.length <= maxChars) return article;
  // MVP：超长则保留头部（通常含主旨）+ 提示已截断。v2 再做摘要缓存 / RAG 切块。
  return article.slice(0, maxChars) + "\n\n[……正文过长，已截断……]";
}

export function buildSystemPrompt(payload, settings) {
  const article = clampArticle(payload.article, settings.maxArticleChars);
  const lang = settings.targetLang || "中文";
  return [
    "你是一个嵌入网页的阅读助手。下面是用户正在阅读的整篇文章（已抽取正文）：",
    '"""',
    article || "（未能抽取到正文，请仅依据用户提供的选中段与上下文作答。）",
    '"""',
    "",
    "用户会划选其中的一段。请【结合整篇文章的语境】解释这段在本文中的具体含义、",
    "作者意图与隐含信息，而不是把它当作孤立句子翻译。若该段涉及专有名词、指代、",
    "前文铺垫或反讽等，要点出它在本文语境下的真实所指。",
    "",
    `输出语言：${lang}。解释要简洁、准确、可读，必要时分点。`,
  ].join("\n");
}

export function buildFirstUserMessage(payload) {
  const parts = [`划选段落：\n"""${payload.selection}"""`];
  if (payload.before || payload.after) {
    parts.push(
      `\n（选区前后文，供定位：…${payload.before || ""} 【选区】 ${payload.after || ""}…）`
    );
  }
  if (payload.title) parts.unshift(`文章标题：${payload.title}`);
  return parts.join("\n");
}

// 组装一次完整对话的初始消息（首条解释）。
export function buildInitialMessages(payload, settings) {
  return [
    { role: "system", content: buildSystemPrompt(payload, settings) },
    { role: "user", content: buildFirstUserMessage(payload) },
  ];
}
