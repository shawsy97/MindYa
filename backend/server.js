// server.js
const express = require("express");
const cors = require("cors");
require("dotenv/config");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: true })); // 生产环境请收紧域名
app.use(express.json({ limit: "1mb" }));

const dataDir = path.join(__dirname, "usr");
const usersPath = path.join(dataDir, "users.json");
const profilesPath = path.join(dataDir, "profiles.csv");
const logsPath = path.join(dataDir, "logs.csv");
const systemLogPath = path.join(dataDir, "system_logs.jsonl");

const ensureDataFiles = () => {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(usersPath)) {
    fs.writeFileSync(usersPath, "[]", "utf-8");
  }
  if (!fs.existsSync(profilesPath)) {
    fs.writeFileSync(
      profilesPath,
      "username,gender,age,grade,scaleResult,modelResult,gameResult,createdAt,updatedAt\n",
      "utf-8"
    );
  }
  if (!fs.existsSync(logsPath)) {
    fs.writeFileSync(logsPath, "username,action,detail,createdAt\n", "utf-8");
  }
  if (!fs.existsSync(systemLogPath)) {
    fs.writeFileSync(systemLogPath, "", "utf-8");
  }
};

const readUsers = () => {
  ensureDataFiles();
  const raw = fs.readFileSync(usersPath, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const writeUsers = (users) => {
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), "utf-8");
};

const csvEscape = (value) => {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const parseCsvLine = (line) => {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
};

const parseCsv = (raw) => {
  const lines = raw.trimEnd().split("\n").filter(Boolean);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    header.forEach((key, idx) => {
      row[key] = values[idx] ?? "";
    });
    return row;
  });
  return { header, rows };
};

const writeCsv = (header, rows, targetPath) => {
  const lines = [
    header.join(","),
    ...rows.map((row) => header.map((key) => csvEscape(row[key])).join(",")),
  ];
  fs.writeFileSync(targetPath, `${lines.join("\n")}\n`, "utf-8");
};

const upsertProfile = ({ username, gender, age, grade }) => {
  ensureDataFiles();
  const { rows } = parseCsv(fs.readFileSync(profilesPath, "utf-8"));
  const header = [
    "username",
    "gender",
    "age",
    "grade",
    "scaleResult",
    "modelResult",
    "gameResult",
    "createdAt",
    "updatedAt",
  ];
  const now = new Date().toISOString();
  let found = rows.find((row) => row.username === username);
  if (!found) {
    found = {
      username,
      gender: "",
      age: "",
      grade: "",
      scaleResult: "",
      modelResult: "",
      gameResult: "",
      createdAt: now,
      updatedAt: now,
    };
    rows.push(found);
  }
  found.gender = gender ?? found.gender;
  found.age = age ?? found.age;
  found.grade = grade ?? found.grade;
  found.updatedAt = now;
  writeCsv(header, rows, profilesPath);
};

const updateResults = ({ username, type, data }) => {
  ensureDataFiles();
  const { rows } = parseCsv(fs.readFileSync(profilesPath, "utf-8"));
  const header = [
    "username",
    "gender",
    "age",
    "grade",
    "scaleResult",
    "modelResult",
    "gameResult",
    "createdAt",
    "updatedAt",
  ];
  const now = new Date().toISOString();
  let found = rows.find((row) => row.username === username);
  if (!found) {
    found = {
      username,
      gender: "",
      age: "",
      grade: "",
      scaleResult: "",
      modelResult: "",
      gameResult: "",
      createdAt: now,
      updatedAt: now,
    };
    rows.push(found);
  }
  const payload = typeof data === "string" ? data : JSON.stringify(data ?? {});
  if (type === "scale") found.scaleResult = payload;
  if (type === "model") found.modelResult = payload;
  if (type === "game") found.gameResult = payload;
  found.updatedAt = now;
  writeCsv(header, rows, profilesPath);
};

const appendLog = ({ username, action, detail }) => {
  ensureDataFiles();
  const payload = typeof detail === "string" ? detail : JSON.stringify(detail ?? {});
  const row = [
    csvEscape(username),
    csvEscape(action),
    csvEscape(payload),
    csvEscape(new Date().toISOString()),
  ].join(",");
  fs.appendFileSync(logsPath, `${row}\n`, "utf-8");
};

const appendSystemLog = (entry) => {
  ensureDataFiles();
  const payload = { ...entry, timestamp: new Date().toISOString() };
  fs.appendFileSync(systemLogPath, `${JSON.stringify(payload)}\n`, "utf-8");
};

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    appendSystemLog({
      type: "system",
      event: res.statusCode >= 400 ? "api_error" : "api_success",
      endpoint: req.originalUrl,
      method: req.method,
      status: res.statusCode,
      duration_ms: durationMs,
    });
  });
  next();
});

app.post("/api/register", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Missing username or password" });
  }
  const users = readUsers();
  if (users.some((u) => u.username === username)) {
    return res.status(409).json({ error: "User already exists" });
  }
  users.push({ username, password, createdAt: new Date().toISOString() });
  writeUsers(users);
  appendLog({ username, action: "register", detail: { username } });
  return res.json({ ok: true });
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Missing username or password" });
  }
  const users = readUsers();
  const found = users.find((u) => u.username === username && u.password === password);
  if (!found) {
    return res.status(401).json({ error: "Invalid credentials" });
  }
  appendLog({ username, action: "login", detail: { username } });
  return res.json({ ok: true });
});

app.post("/api/profile", (req, res) => {
  const { username, gender, age, grade } = req.body || {};
  if (!username) {
    return res.status(400).json({ error: "Missing username" });
  }
  upsertProfile({ username, gender, age, grade });
  appendLog({ username, action: "profile", detail: { gender, age, grade } });
  return res.json({ ok: true });
});

app.post("/api/results", (req, res) => {
  const { username, type, data } = req.body || {};
  if (!username || !type) {
    return res.status(400).json({ error: "Missing username or type" });
  }
  updateResults({ username, type, data });
  appendLog({ username, action: `result:${type}`, detail: data });
  return res.json({ ok: true });
});

app.post("/api/log", (req, res) => {
  const { type, session_id, event, message_length, risk_level, signals, action_taken, detail } = req.body || {};
  if (!type || !event) {
    return res.status(400).json({ error: "Missing type or event" });
  }
  appendSystemLog({
    type,
    session_id,
    event,
    message_length,
    risk_level,
    signals,
    action_taken,
    detail,
  });
  return res.json({ ok: true });
});

app.post("/api/chat", async (req, res) => {
  try {
    const chatStart = Date.now();
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
      appendSystemLog({
        type: "system",
        event: "api_error",
        endpoint: "/api/chat",
        status: resp.status,
        error_code: "QWEN_UPSTREAM_ERROR",
      });
      return res.status(500).json({ error: "Upstream error", detail: errText });
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content ?? "";
    appendSystemLog({
      type: "conversation_event",
      event: "ai_response",
      session_id: req.body?.session_id,
      latency_ms: Date.now() - chatStart,
      success: true,
    });
    res.json({ text, raw: data });
  } catch (e) {
    appendSystemLog({
      type: "system",
      event: "api_error",
      endpoint: "/api/chat",
      status: 500,
      error_code: "QWEN_TIMEOUT",
      detail: String(e),
    });
    res.status(500).json({ error: "Server error", detail: String(e) });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  appendSystemLog({ type: "system", event: "service_start", endpoint: "server", status: 200 });
  console.log(`API listening on http://0.0.0.0:${PORT}`);
});
app.get("/api/ping", (req, res) => res.json({ ok: true }));
