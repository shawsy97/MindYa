// server.js
import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors({ origin: true })); // 生产环境请收紧域名
app.use(express.json({ limit: "1mb" }));

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, userProfile, role } = req.body;

    // 1) 拼 system prompt：把“非诊断/未成年人/风险引导”写死在后端
    const system = `
你是青少年心理健康陪伴式AI助手。遵守：
- 不做心理疾病诊断，不使用医学标签；
- 优先共情、陪伴、鼓励表达；
- 若出现自伤/轻生/极端风险表达：保持冷静，明确建议联系现实可信任的大人/学校心理资源，并提供求助渠道。
角色：${role || "日常陪伴"}。
用户信息：年龄=${userProfile?.age || ""} 年级=${userProfile?.grade || ""} 性别=${userProfile?.gender || ""}.
`;

    // 2) 调用 DashScope OpenAI 兼容接口
    const resp = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DASHSCOPE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "qwen-plus",        // 你可换成你开通的模型
        messages: [
          { role: "system", content: system },
          ...messages, // [{role:"user"|"assistant", content:"..."}]
        ],
        temperature: 0.7,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(500).json({ error: "Upstream error", detail: errText });
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    res.json({ text, raw: data });
  } catch (e) {
    res.status(500).json({ error: "Server error", detail: String(e) });
  }
});

app.listen(3001, () => console.log("API listening on http://localhost:3001"));
app.get("/api/ping", (req, res) => res.json({ ok: true }));
