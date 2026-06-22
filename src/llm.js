// OpenAI 兼容的流式对话客户端。在 side panel（持久页面）中调用，避免 service worker 被回收。

export async function streamChat({ messages, settings, onDelta, signal }) {
  if (settings.useMock || !settings.apiKey) {
    return mockStream({ messages, onDelta, signal });
  }

  const url = settings.baseURL.replace(/\/$/, "") + "/chat/completions";
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + settings.apiKey,
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      stream: true,
    }),
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
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onDelta(delta, full);
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
