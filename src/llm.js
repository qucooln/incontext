// OpenAI 兼容的流式对话客户端。在 side panel（持久页面）中调用，避免 service worker 被回收。
// 始终使用主模型(settings.baseURL/model/apiKey，如 deepseek-v4-pro)。
// 联网时由调用方先搜好资料，作为 extraContext 临时注入（不污染存储的对话历史）。

// 联网前：先用主模型把"选区+上下文+意图"还原成一个精准的搜索查询（而非孤立的原文）。
// 返回查询字符串；若判断无需联网返回 null；出错时调用方应回退到原文。
export async function generateSearchQuery(ctx, settings) {
  const { selection = "", title = "", before = "", after = "", question = "" } = ctx;
  const fallback = (question || selection || "").trim().slice(0, 80);
  if (settings.useMock || !settings.apiKey) return fallback;

  const sys =
    "你是搜索查询生成器。根据用户正在阅读的文章片段与意图，生成一个最有助于补充背景/事实/最新信息的网络搜索查询。\n" +
    "规则：1) 只输出查询词本身，一行，不要引号、不要解释；2) 必须结合上下文还原指代与主题，不要只用孤立的词；" +
    "3) 若这段内容无需联网（纯文章内部含义、纯常识、纯主观解读），只输出 NONE。";
  const user =
    `文章标题：${title}\n选中段：${selection}\n` +
    `前后文：…${(before || "").slice(-200)}【选区】${(after || "").slice(0, 200)}…\n` +
    `用户问题：${question || "（解释这段在本文中的含义）"}`;

  const url = settings.baseURL.replace(/\/$/, "") + "/chat/completions";
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + settings.apiKey },
    body: JSON.stringify({
      model: settings.model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      max_tokens: 300,
      stream: false,
    }),
  });
  if (!resp.ok) throw new Error(`查询生成 ${resp.status}: ${(await resp.text()).slice(0, 150)}`);
  const d = await resp.json();
  const content = (d.choices?.[0]?.message?.content || "").trim();
  if (/^none$/i.test(content)) return null;
  const q = content.replace(/^["'「『]+|["'」』]+$/g, "").split("\n")[0].trim();
  return q || fallback;
}

export async function streamChat({ messages, settings, onDelta, onThinking, signal, extraContext }) {
  if (settings.useMock || !settings.apiKey) {
    return mockStream({ messages, onDelta, signal });
  }

  // 把联网资料作为一条临时 system 消息，插在最后一条用户消息之前；不改动传入的 messages。
  let apiMessages = messages;
  if (extraContext) {
    apiMessages = [...messages];
    const insertAt = Math.max(1, apiMessages.length - 1);
    apiMessages.splice(insertAt, 0, { role: "system", content: extraContext });
  }

  const url = settings.baseURL.replace(/\/$/, "") + "/chat/completions";
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + settings.apiKey,
    },
    body: JSON.stringify({ model: settings.model, messages: apiMessages, stream: true }),
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
        // 推理模型(如 deepseek-reasoner)的思考流，单独回调，不混入正式答案
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
