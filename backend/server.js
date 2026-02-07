// server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require('bcryptjs');

// 始终使用文件存储模式，不连接数据库
const dbConnected = false;
console.log("系统将以文件存储模式运行，数据将存储在本地文件中");

// 预定义模型变量（不实际连接数据库）
let User, Profile, Scale, Conversation, Task, Admin, Analytics, Log;

const app = express();
const PORT = process.env.PORT || 3001;

const corsOptions = {
  origin: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions)); // 生产环境请收紧域名
app.options('*', (req, res) => {  
  // your CORS handling  
  res.sendStatus(200);  
});  
app.use(express.json({ limit: "1mb" }));

// 文件存储相关路径
const dataDir = path.join(__dirname, "usr");
const usersPath = path.join(dataDir, "users.json");
const profilesPath = path.join(dataDir, "profiles.csv");
const resultsPath = path.join(dataDir, "results.csv");
const logsPath = path.join(dataDir, "logs.csv");
const systemLogPath = path.join(dataDir, "system_logs.jsonl");
const conversationsPath = path.join(dataDir, "conversations.json");

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
  if (!fs.existsSync(resultsPath)) {
    fs.writeFileSync(resultsPath, "username,type,data,createdAt\n", "utf-8");
  }
  if (!fs.existsSync(logsPath)) {
    fs.writeFileSync(logsPath, "username,action,detail,createdAt\n", "utf-8");
  }
  if (!fs.existsSync(systemLogPath)) {
    fs.writeFileSync(systemLogPath, "", "utf-8");
  }
  if (!fs.existsSync(conversationsPath)) {
    fs.writeFileSync(conversationsPath, "{}", "utf-8");
  }
};

const readConversations = () => {
  ensureDataFiles();
  return JSON.parse(fs.readFileSync(conversationsPath, "utf-8"));
};

const writeConversations = (data) => {
  fs.writeFileSync(conversationsPath, JSON.stringify(data, null, 2), "utf-8");
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
  if (type === "game" || type === "task") found.gameResult = payload;
  found.updatedAt = now;
  writeCsv(header, rows, profilesPath);
};

const appendResult = ({ username, type, data }) => {
  ensureDataFiles();
  const payload = typeof data === "string" ? data : JSON.stringify(data ?? {});
  const row = [
    csvEscape(username),
    csvEscape(type),
    csvEscape(payload),
    csvEscape(new Date().toISOString()),
  ].join(",");
  fs.appendFileSync(resultsPath, `${row}\n`, "utf-8");
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

// 原有用户注册API
app.post("/api/register", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Missing username or password" });
    }
    
    // 始终使用文件存储模式
    const users = readUsers();
    if (users.some((u) => u.username === username)) {
      return res.status(409).json({ error: "User already exists" });
    }
    
    users.push({ 
      username, 
      password, // 在实际部署中应加密密码
      role: 'student',
      createdAt: new Date().toISOString()
    });
    writeUsers(users);
    appendLog({ username, action: "register", detail: { username } });
    
    return res.json({ ok: true });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 原有用户登录API
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Missing username or password" });
    }
    
    // 始终使用文件存储模式
    const users = readUsers();
    const found = users.find((u) => u.username === username && u.password === password);
    if (!found) {
      return res.status(401).json({ error: "Invalid credentials" });
    }
    appendLog({ username, action: "login", detail: { username } });
    return res.json({ ok: true });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理员登录API
app.post("/api/admin/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: "Missing username or password" });
    }
    
    // 无论数据库是否连接，都使用固定账户登录（简化实现）
    if (username === 'admin' && password === 'admin123') {
      return res.json({ 
        ok: true, 
        adminId: 'file_admin_1', 
        role: 'admin',
        school: 'Default School',
        department: 'Default Department'
      });
    } else {
      return res.status(401).json({ error: "Invalid credentials" });
    }
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({ error: 'Internal server error傻逼' });
  }
});

// 管理员获取对话记录API
app.get("/api/admin/conversations", async (req, res) => {
  try {
    // 始终使用文件存储模式 - 从conversations.json读取数据
    const allConversations = readConversations();
    const result = [];
    
    // 将对象格式转换为数组格式
    for (const [username, userConversations] of Object.entries(allConversations)) {
      for (const conversation of userConversations) {
        result.push({
          ...conversation,
          username
        });
      }
    }
    
    return res.json(result);
  } catch (error) {
    console.error('Get conversations error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理员获取所有用户信息API
// 在 server.js 中找到 /api/admin/users API，修改如下：
app.get("/api/admin/users", async (req, res) => {
  try {
    // 读取 users.json
    const users = readUsers();
    
    console.log('原始用户数据:', users); // 添加日志
    
    // 读取 profiles.csv
    const profilesContent = fs.readFileSync(profilesPath, 'utf-8');
    const profiles = parseCsv(profilesContent);
    
    console.log('Profile 数据行数:', profiles.rows.length); // 添加日志
    
    // 创建 profile 映射
    const profileMap = {};
    for (const row of profiles.rows) {
      if (row.username) {
        profileMap[row.username] = {
          gender: row.gender || '',
          age: row.age || '',
          grade: row.grade || '',
          scaleResult: row.scaleResult || '',
          modelResult: row.modelResult || '',
          gameResult: row.gameResult || '',
          createdAt: row.createdAt || '',
          updatedAt: row.updatedAt || ''
        };
      }
    }
    
    // 合并用户数据和 profile 数据，为每个用户添加默认角色
    const usersWithProfiles = users.map(user => {
      // 如果没有 role，默认为 'student'
      const userRole = user.role || 'student';
      
      return {
        _id: user._id || user.username,
        username: user.username,
        password: user.password,
        role: userRole,
        createdAt: user.createdAt || new Date().toISOString(),
        lastLoginAt: user.lastLoginAt || null,
        profile: profileMap[user.username] || null
      };
    });
    
    console.log('处理后用户数:', usersWithProfiles.length); // 添加日志
    
    return res.json(usersWithProfiles);
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理员获取量表结果统计
app.get("/api/admin/scales", async (req, res) => {
  try {
    // 始终使用文件存储模式 - 从results.csv中读取量表数据
    const rawData = fs.readFileSync(resultsPath, 'utf-8');
    const lines = rawData.split('\n').filter(l => l.trim() !== '');
    const scales = [];
    
    for (let i = 1; i < lines.length; i++) { // 跳过标题行
      const values = parseCsvLine(lines[i]);
      if (values.length >= 4 && values[1] === 'scale') { // 只获取量表数据
        try {
          const parsedData = JSON.parse(values[2]);
          scales.push({
            _id: i,
            username: values[0],
            scaleName: parsedData.scaleName || 'Unknown Scale',
            totalScore: parsedData.totalScore || 0,
            riskLevel: parsedData.riskLevel || 'low',
            submittedAt: values[3]
          });
        } catch (e) {
          // 如果解析JSON失败，跳过这一行
          continue;
        }
      }
    }
    
    return res.json(scales);
  } catch (error) {
    console.error('Get scales error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理员获取高风险学生
app.get("/api/admin/high-risk-students", async (req, res) => {
  try {
    // 始终使用文件存储模式
    const rawData = fs.readFileSync(resultsPath, 'utf-8');
    const lines = rawData.split('\n').filter(l => l.trim() !== '');
    const highRiskScales = [];
    
    for (let i = 1; i < lines.length; i++) { // 跳过标题行
      const values = parseCsvLine(lines[i]);
      if (values.length >= 4 && values[1] === 'scale') { // 只获取量表数据
        try {
          const parsedData = JSON.parse(values[2]);
          if (parsedData.riskLevel === 'high') {
            highRiskScales.push({
              _id: i,
              username: values[0],
              scaleName: parsedData.scaleName || 'Unknown Scale',
              totalScore: parsedData.totalScore || 0,
              riskLevel: parsedData.riskLevel,
              submittedAt: values[3]
            });
          }
        } catch (e) {
          // 如果解析JSON失败，跳过这一行
          continue;
        }
      }
    }
    
    return res.json({
      scales: highRiskScales,
      analytics: []
    });
  } catch (error) {
    console.error('Get high risk students error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 原有档案API
app.post("/api/profile", async (req, res) => {
  try {
    const { username, gender, age, grade } = req.body || {};
    if (!username) {
      return res.status(400).json({ error: "Missing username" });
    }
    
    // 始终使用文件存储模式
    upsertProfile({ username, gender, age, grade });
    appendLog({ username, action: 'profile', detail: { gender, age, grade } });
    return res.json({ ok: true });
  } catch (error) {
    console.error('Profile update error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 原有结果API
app.post("/api/results", async (req, res) => {
  try {
    const { username, type, data } = req.body || {};
    if (!username || !type) {
      return res.status(400).json({ error: "Missing username or type" });
    }
    
    // 始终使用文件存储模式
    updateResults({ username, type, data });
    appendResult({ username, type, data });
    appendLog({ username, action: `result:${type}`, detail: data });
    return res.json({ ok: true });
  } catch (error) {
    console.error('Save results error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post("/api/log", async (req, res) => {
  try {
    const { type, session_id, event, message_length, risk_level, signals, action_taken, detail, userId } = req.body || {};
    if (!type || !event) {
      return res.status(400).json({ error: "Missing type or event" });
    }
    
    // 始终使用文件存储模式 - 使用日志文件记录
    appendLog({ 
      type, 
      session_id, 
      event, 
      message_length, 
      risk_level, 
      signals, 
      action_taken, 
      detail 
    });
    
    return res.json({ ok: true });
  } catch (error) {
    console.error('Log error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.post("/api/chat", async (req, res) => {
  try {
    const chatStart = Date.now();
    const { messages, userProfile, role } = req.body;

    // 1) 拼 system prompt：把"非诊断/未成年人/风险引导"写死在后端
    const system = `
# 角色
你是"心芽（MindYa）"，一个专门为 8-18 岁青少年设计的心理健康陪伴伙伴 [cite: 6]。你像一个懂孩子、温柔的大哥哥或大姐姐，而不是老师或医生。

# 核心准则
1. 低门槛陪伴：像聊天一样自然，避免使用"潜意识、认知偏差、实验"等专业术语 。
2. 非标签化：不输出医学结论（如"你抑郁了"），描述状态（如"最近你似乎有些累"） 。
3. 陪伴导向：优先通过共情（如"听起来好辛苦"、"我能理解那种感觉"）来建立信任 。
4. 回复时篇幅不要过长，引导学生继续聊天即可。

# 对话策略（阶段化引导）
- 阶段 1（前 3-4 轮）：专注于"看见"用户的情绪，通过开放式提问鼓励表达（例如：你平时遇到这种情况会怎么做？）。
- 阶段 2（建立连接后）：如果察觉到用户有压力、困扰，可以自然地推荐工具。
  - 推荐量表：称之为"心情小测试"或"心理天气预报"。
  - 推荐游戏：称之为"放松小练习"或"心情解压阀"。
- 阶段 3（风险拦截）：若发现自伤/极端风险，立即转入稳定情绪模式，明确引导其联系现实中的大人 [cite: 62]。

# 当前用户信息
年龄：${userProfile?.age || ""}；年级：${userProfile?.grade || ""}；性别：${userProfile?.gender || ""}。
请根据年级调整语气（小学多用鼓励和比喻，高中生可以多一些平等的情绪梳理） 。
`;

    // 2) 调用 DashScope OpenAI 兼容接口
    const resp = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DASHSCOPE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "qwen3-max",        // 你可换成你开通的模型
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

// 获取用户的聊天记录列表
app.get("/api/history/:username", async (req, res) => {
  try {
    const { username } = req.params;
    
    // 始终使用文件存储模式
    const allHistory = readConversations();
    const userHistory = allHistory[username] || [];
    res.json(userHistory);
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 保存或更新当前对话
app.post("/api/history/save", async (req, res) => {
  try {
    const { username, conversationId, messages, preview } = req.body;
    
    // 始终使用文件存储模式
    const allHistory = readConversations();
    if (!allHistory[username]) allHistory[username] = [];
    
    const index = allHistory[username].findIndex(c => c.id === conversationId);
    const record = { id: conversationId, messages, preview, updatedAt: new Date().toISOString() };
    
    if (index > -1) {
      allHistory[username][index] = record;
    } else {
      allHistory[username].unshift(record); // 新对话放在最前面
    }
    
    writeConversations(allHistory);
    res.json({ ok: true });
  } catch (error) {
    console.error('Save history error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  appendSystemLog({ type: "system", event: "service_start", endpoint: "server", status: 200 });
  console.log(`API listening on http://0.0.0.0:${PORT}`);
  if (!dbConnected) {
    console.log("系统以文件存储模式运行，数据将存储在本地文件中");
  }
});
app.get("/api/ping", (req, res) => res.json({ ok: true }));