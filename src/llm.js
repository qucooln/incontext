// OpenAI 兼容的流式对话客户端。在 side panel（持久页面）中调用，避免 service worker 被回收。
// 支持两种端点：常规模型（settings.baseURL/model/apiKey）与联网模型（settings.search*，借 GLM 原生 web_search）。

function resolveEndpoint(settings, useSearch) {
  if (useSearch) {
    return {
      baseURL: settings.searchBaseURL,
      model: settings.searchModel,
      apiKey: settings.searchApiKey,
      search: true,
    };
  }
  return { baseURL: settings.baseURL, model: settings.model, apiKey: settings.apiKey, search: false };
}

export async function streamChat({ messages, settings, onDelta, onThinking, signal, useSearch }) {
  const ep = resolveEndpoint(settings, useSearch);

  if (settings.useMock || !ep.apiKey) {
    if (useSearch && !ep.apiKey) {
      throw new Error("联网需要在设置里填「联网搜索 GLM Key」（智谱 key）");
    }
    return mockStream({ messages, onDelta, signal });
  }

  const url = ep.baseURL.replace(/\/$/, "") + "/chat/completions";
  const body = {
    model: ep.model,
    messages,
    stream: true,
  };
  if (ep.search) {
    // 智谱 GLM 原生联网搜索
    body.tools = [{ type: "web_search", web_search: { enable: true, search_result: true } }];
    // glm-5.2 是推理模型，先吐 reasoning_content，需给足 token 否则正式答案为空
    body.max_tokens = 4096;
  }

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + ep.apiKey,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`API ${resp.status}: ${text.slice(0, 300)}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const json = JSON.parse(data);
        const delta = json.choices?.[0]?.delta || {};
        // 推理模型的思考流，单独回调（可显示"检索/思考中"），不混入正式答案
        if (delta.reasoning_content && onThinking) onThinking(delta.reasoning_content);
        if (delta.content) {
          full += delta.content;
          onDelta(delta.content, full);
        }
      } catch {
        // 忽略半截/keepalive 行
      }
    }
  }
  return full;
}

// 无 key 时的本地 mock：模拟流式输出，用于联调交互与 grounding 拼装逻辑。
async function mockStream({ messages, onDelta, signal }) {
  const sys = messages.find((m) => m.role === "system")?.content || "";
  const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content || "";
  const hasArticle = sys.includes('"""') && !sys.includes("未能抽取到正文");
  const demo =
    `【MOCK 演示 · 未接真实模型】\n\n` +
    `已收到选中段与${hasArticle ? "整篇全文上下文" : "（注意：未抽到正文）"}。\n\n` +
    `你的输入：\n${lastUser.slice(0, 400)}\n\n` +
    `把真实 API key 填进设置页（或丢给开发者），这里就会变成"结合全文"的真实解释。`;
  let full = "";
  for (const ch of demo) {
    if (signal?.aborted) break;
    full += ch;
    onDelta(ch, full);
    await new Promise((r) => setTimeout(r, 4));
  }
  return full;
}
