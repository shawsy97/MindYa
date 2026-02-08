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
const PORT = 8080;

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
  
  // 先去除行尾的 \r
  line = line.replace(/\r$/, '');
  
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

// server.js - 检查 parseCsv 函数
// server.js - 修复 CSV 解析中的 \r 问题
// 修改 parseCsv 函数，清理字段值
const parseCsv = (raw) => {
  const lines = raw.trimEnd().split("\n").filter(Boolean);
  if (lines.length === 0) return { header: [], rows: [] };
  
  // 清理标题行，去除 \r
  const header = parseCsvLine(lines[0]).map(h => h.replace(/\r/g, '').trim());
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    header.forEach((key, idx) => {
      // 清理每个值，去除 \r 和多余空格
      row[key] = (values[idx] ?? "").replace(/\r/g, '').trim();
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

// 管理员获取量表结果统计 - 修改版
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
          // 解析JSON数据，注意csv中的JSON是双引号转义的
          let dataStr = values[2];
          // 移除可能的转义字符
          dataStr = dataStr.replace(/\\"/g, '"');
          // 如果字符串以引号开头和结尾，去掉它们
          if (dataStr.startsWith('"') && dataStr.endsWith('"')) {
            dataStr = dataStr.slice(1, -1);
          }

          const parsedData = JSON.parse(dataStr);

          // 构建scale对象
          const scale = {
            _id: i,
            username: values[0],
            submittedAt: values[3]
          };

          // 处理不同的数据格式
          if (parsedData.scaleId) {
            scale.scaleId = parsedData.scaleId;
            scale.scaleName = getScaleName(parsedData.scaleId); // 获取量表名称
          } else if (parsedData.scaleName) {
            scale.scaleId = parsedData.scaleName;
            scale.scaleName = parsedData.scaleName;
          } else {
            scale.scaleId = 'Unknown';
            scale.scaleName = '未知量表';
          }

          // 获取总分
          if (parsedData.score && parsedData.score.total) {
            scale.totalScore = parsedData.score.total;
          } else if (parsedData.totalScore) {
            scale.totalScore = parsedData.totalScore;
          } else {
            scale.totalScore = 0;
          }

          // 获取风险等级
          if (parsedData.flags && parsedData.flags.riskLevel) {
            scale.riskLevel = parsedData.flags.riskLevel;
          } else if (parsedData.riskLevel) {
            scale.riskLevel = parsedData.riskLevel;
          } else {
            scale.riskLevel = 'low';
          }

          // 保存完整的数据用于详情显示
          scale.fullData = parsedData;

          // 添加答案数据
          if (parsedData.answers) {
            scale.answers = parsedData.answers;
          }

          // 添加得分详情
          if (parsedData.score) {
            scale.scoreDetails = parsedData.score;
          }

          // 添加等级信息
          if (parsedData.level) {
            scale.level = parsedData.level;
          }

          scales.push(scale);
        } catch (e) {
          console.error('解析量表数据失败:', e.message, '行数据:', values[2]);
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
// 获取单个量表的详细信息
app.get("/api/admin/scale/:id", async (req, res) => {
  try {
    const scaleId = parseInt(req.params.id);

    const rawData = fs.readFileSync(resultsPath, 'utf-8');
    const lines = rawData.split('\n').filter(l => l.trim() !== '');

    if (scaleId <= 0 || scaleId >= lines.length) {
      return res.status(404).json({ error: '量表记录不存在' });
    }

    const values = parseCsvLine(lines[scaleId]);

    if (values.length < 4 || values[1] !== 'scale') {
      return res.status(404).json({ error: '不是有效的量表记录' });
    }

    try {
      // 解析JSON数据
      let dataStr = values[2];
      dataStr = dataStr.replace(/\\"/g, '"');
      if (dataStr.startsWith('"') && dataStr.endsWith('"')) {
        dataStr = dataStr.slice(1, -1);
      }

      const parsedData = JSON.parse(dataStr);

      const scale = {
        _id: scaleId,
        username: values[0],
        submittedAt: values[3],
        fullData: parsedData
      };

      // 处理不同的数据格式
      if (parsedData.scaleId) {
        scale.scaleId = parsedData.scaleId;
        scale.scaleName = getScaleName(parsedData.scaleId);
      } else if (parsedData.scaleName) {
        scale.scaleId = parsedData.scaleName;
        scale.scaleName = parsedData.scaleName;
      }

      // 获取总分
      if (parsedData.score && parsedData.score.total) {
        scale.totalScore = parsedData.score.total;
      } else if (parsedData.totalScore) {
        scale.totalScore = parsedData.totalScore;
      }

      // 获取风险等级
      if (parsedData.flags && parsedData.flags.riskLevel) {
        scale.riskLevel = parsedData.flags.riskLevel;
      } else if (parsedData.riskLevel) {
        scale.riskLevel = parsedData.riskLevel;
      }

      // 添加答案数据
      if (parsedData.answers) {
        scale.answers = parsedData.answers;
      }

      // 添加得分详情
      if (parsedData.score) {
        scale.scoreDetails = parsedData.score;
      }

      // 添加等级信息
      if (parsedData.level) {
        scale.level = parsedData.level;
      }

      return res.json(scale);
    } catch (e) {
      console.error('解析量表详情失败:', e.message);
      return res.status(500).json({ error: '解析数据失败' });
    }
  } catch (error) {
    console.error('Get scale detail error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
// 辅助函数：根据scaleId获取量表名称
function getScaleName(scaleId) {
  const scaleNames = {
    'SRSS': '学生风险筛查量表',
    'PHQ-9': '抑郁症筛查量表',
    'GAD-7': '广泛性焦虑量表',
    'BDI': '贝克抑郁量表',
    'SCL-90': '症状自评量表',
    'SDS': '抑郁自评量表',
    'SAS': '焦虑自评量表'
  };

  return scaleNames[scaleId] || scaleId;
}



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



// server.js - 修复时间格式错误
// 管理员获取概览统计数据API
app.get("/api/admin/overview/stats", async (req, res) => {
  try {
    // 读取用户数据
    const users = readUsers();
    const userProfiles = fs.existsSync(profilesPath) ?
      parseCsv(fs.readFileSync(profilesPath, 'utf-8')).rows : [];

    // 读取量表结果数据
    const scaleResults = fs.existsSync(resultsPath) ?
      parseCsv(fs.readFileSync(resultsPath, 'utf-8')).rows : [];

    // 读取活动日志
    const logs = fs.existsSync(logsPath) ?
      parseCsv(fs.readFileSync(logsPath, 'utf-8')).rows : [];

    // 获取今天的日期（YYYY-MM-DD格式）
    const today = new Date().toISOString().split('T')[0];

    // 安全地获取日期函数
    const getDateFromString = (dateString) => {
      try {
        if (!dateString || dateString.trim() === '') {
          return null;
        }
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date;
      } catch (e) {
        return null;
      }
    };

    // 用户统计数据
    const userStats = {
      total: users.length,
      todayLogin: logs.filter(log => {
        const date = getDateFromString(log.createdAt);
        if (!date) return false;
        const logDate = date.toISOString().split('T')[0];
        return log.action === 'login' && logDate === today;
      }).length,
      todayRegister: logs.filter(log => {
        const date = getDateFromString(log.createdAt);
        if (!date) return false;
        const logDate = date.toISOString().split('T')[0];
        return log.action === 'register' && logDate === today;
      }).length,
      withProfile: userProfiles.length
    };

    // 量表统计数据
    const scaleStats = {
      total: scaleResults.filter(r => r.type === 'scale').length,
      today: scaleResults.filter(r => {
        const date = getDateFromString(r.createdAt);
        if (!date) return false;
        const logDate = date.toISOString().split('T')[0];
        return r.type === 'scale' && logDate === today;
      }).length,
      // 不同类型量表统计
      byType: {
        DASS21: scaleResults.filter(r => {
          try {
            const data = JSON.parse(r.data);
            return r.type === 'scale' && (data.scaleId === 'DASS21' || data.scaleName === 'DASS-21');
          } catch {
            return false;
          }
        }).length,
        PHQ9_CHILD: scaleResults.filter(r => {
          try {
            const data = JSON.parse(r.data);
            return r.type === 'scale' && (data.scaleId === 'PHQ9_CHILD' || data.scaleName === 'PHQ-9 抑郁量表');
          } catch {
            return false;
          }
        }).length,
        SRSS: scaleResults.filter(r => {
          try {
            const data = JSON.parse(r.data);
            return r.type === 'scale' && (data.scaleId === 'SRSS' || data.scaleName === 'SRSS 睡眠质量问卷');
          } catch {
            return false;
          }
        }).length,
        ERQ: scaleResults.filter(r => {
          try {
            const data = JSON.parse(r.data);
            return r.type === 'scale' && (data.scaleId === 'ERQ' || data.scaleName === 'ERQ 情绪调节问卷');
          } catch {
            return false;
          }
        }).length,
        SCHOOL_AVERSION: scaleResults.filter(r => {
          try {
            const data = JSON.parse(r.data);
            return r.type === 'scale' && (data.scaleId === 'SCHOOL_AVERSION' || data.scaleName === '厌学量表');
          } catch {
            return false;
          }
        }).length
      }
    };

    // 游戏（task）统计数据
    const taskStats = {
      total: scaleResults.filter(r => r.type === 'task').length,
      today: scaleResults.filter(r => {
        const date = getDateFromString(r.createdAt);
        if (!date) return false;
        const logDate = date.toISOString().split('T')[0];
        return r.type === 'task' && logDate === today;
      }).length,
      // 不同类型任务统计
      byType: {
        CPT_X: scaleResults.filter(r => {
          try {
            const data = JSON.parse(r.data);
            return r.type === 'task' && (data.taskId === 'CPT_X' || data.taskId === 'cpt');
          } catch {
            return false;
          }
        }).length,
        OTHER: scaleResults.filter(r => {
          try {
            const data = JSON.parse(r.data);
            return r.type === 'task' && data.taskId && data.taskId !== 'CPT_X' && data.taskId !== 'cpt';
          } catch {
            return false;
          }
        }).length
      }
    };

    // 最近7天的趋势数据
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      return date.toISOString().split('T')[0];
    }).reverse();

    const dailyStats = last7Days.map(day => {
      const usersCount = logs.filter(log => {
        const date = getDateFromString(log.createdAt);
        if (!date) return false;
        const logDate = date.toISOString().split('T')[0];
        return (log.action === 'login' || log.action === 'register') && logDate === day;
      }).length;

      const scalesCount = scaleResults.filter(r => {
        const date = getDateFromString(r.createdAt);
        if (!date) return false;
        const logDate = date.toISOString().split('T')[0];
        return r.type === 'scale' && logDate === day;
      }).length;

      const tasksCount = scaleResults.filter(r => {
        const date = getDateFromString(r.createdAt);
        if (!date) return false;
        const logDate = date.toISOString().split('T')[0];
        return r.type === 'task' && logDate === day;
      }).length;

      return {
        date: day,
        users: usersCount,
        scales: scalesCount,
        tasks: tasksCount
      };
    });

    return res.json({
      users: userStats,
      scales: scaleStats,
      tasks: taskStats,
      dailyStats,
      lastUpdated: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get overview stats error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});


// 简化活动API，使用修复后的parseCsv函数
app.get("/api/admin/overview/activities", async (req, res) => {
  try {
    console.log('开始读取活动日志...');
    console.log('日志文件路径:', logsPath);
    
    // 检查日志文件是否存在
    if (!fs.existsSync(logsPath)) {
      console.log('日志文件不存在，创建空文件');
      fs.writeFileSync(logsPath, "username,action,detail,createdAt\n", "utf-8");
    }
    
    // 读取活动日志
    const logsContent = fs.readFileSync(logsPath, 'utf-8');
    console.log('日志文件内容长度:', logsContent.length);
    
    if (logsContent.trim() === '' || logsContent.trim() === 'username,action,detail,createdAt') {
      console.log('日志文件为空或只有标题行');
      return res.json([]);
    }
    
    // 使用修复后的parseCsv函数
    const logs = parseCsv(logsContent);
    console.log('解析后的日志行数:', logs.rows.length);
    
    if (logs.rows.length > 0) {
      console.log('第一条日志(已清理):', logs.rows[0]);
    }
    
    // 安全地获取日期函数
    const getDateFromString = (dateString) => {
      try {
        if (!dateString || dateString.trim() === '') {
          return null;
        }
        // 清理日期字符串
        dateString = dateString.replace(/\r/g, '').trim();
        const date = new Date(dateString);
        return isNaN(date.getTime()) ? null : date;
      } catch (e) {
        return null;
      }
    };
    
    // 格式化活动数据
    const activities = logs.rows.map(log => {
      let detail = '';
      let icon = 'User';
      let color = 'blue';
      
      // 安全地获取时间
      const logDate = getDateFromString(log.createdAt);
      const timeAgo = logDate ? getTimeAgo(log.createdAt) : '未知时间';
      
      // 解析日志详情
      try {
        if (log.action === 'register') {
          detail = `用户 ${log.username} 注册了账号`;
          icon = 'UserPlus';
          color = 'green';
        } else if (log.action === 'login') {
          detail = `用户 ${log.username} 登录了系统`;
          icon = 'LogIn';
          color = 'blue';
        } else if (log.action === 'profile') {
          try {
            const parsedDetail = JSON.parse(log.detail || '{}');
            const profileInfo = [];
            if (parsedDetail.gender) profileInfo.push(`性别: ${parsedDetail.gender}`);
            if (parsedDetail.age) profileInfo.push(`年龄: ${parsedDetail.age}`);
            if (parsedDetail.grade) profileInfo.push(`年级: ${parsedDetail.grade}`);
            
            detail = `用户 ${log.username} 更新了个人资料${profileInfo.length > 0 ? ` (${profileInfo.join(', ')})` : ''}`;
          } catch {
            detail = `用户 ${log.username} 更新了个人资料`;
          }
          icon = 'UserCheck';
          color = 'purple';
        } else if (log.action === 'result:scale') {
          try {
            const scaleData = JSON.parse(log.detail);
            const scaleName = scaleData.scaleName || '未知量表';
            const totalScore = scaleData.score?.total || scaleData.totalScore || '未知';
            detail = `用户 ${log.username} 完成了 ${scaleName} 测评 (总分: ${totalScore})`;
          } catch {
            detail = `用户 ${log.username} 完成了一个量表测评`;
          }
          icon = 'BarChart3';
          color = 'orange';
        } else if (log.action === 'result:task' || log.action.includes('task')) {
          // 游戏日志：只显示基本信息，不显示详细数据
          try {
            const taskData = JSON.parse(log.detail);
            const taskName = taskData.taskId === 'CPT_X' ? '注意力测试(CPT-X)' : 
                            taskData.taskId === 'cpt' ? '注意力测试' : 
                            taskData.taskId || '认知训练游戏';
            detail = `用户 ${log.username} 完成了 ${taskName}`;
          } catch {
            detail = `用户 ${log.username} 完成了一个认知训练游戏`;
          }
          icon = 'Gamepad';
          color = 'green';
        } else {
          detail = `用户 ${log.username} 执行了 ${log.action} 操作`;
          icon = 'Activity';
          color = 'gray';
        }
      } catch (parseError) {
        console.log('解析日志详情失败:', parseError, '日志内容:', log);
        detail = `用户 ${log.username} 执行了 ${log.action} 操作`;
        icon = 'Activity';
        color = 'gray';
      }
      
      return {
        id: `${log.username}_${log.createdAt}`,
        username: log.username,
        action: log.action,
        detail,
        icon,
        color,
        createdAt: log.createdAt,
        timeAgo
      };
    })
    .filter(activity => activity.timeAgo !== '未知时间') // 过滤掉时间无效的活动
    .slice(-20) // 只取最近20条
    .reverse(); // 按时间倒序排列（最新的在前面）
    
    console.log('返回的活动数量:', activities.length);
    return res.json(activities);
  } catch (error) {
    console.error('获取活动日志错误:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
// 辅助函数：计算时间差
// 修改 getTimeAgo 函数，使其更健壮
function getTimeAgo(timestamp) {
  try {
    if (!timestamp || timestamp.trim() === '') {
      return '未知时间';
    }
    
    // 清理时间戳中的 \r
    timestamp = timestamp.replace(/\r/g, '').trim();
    
    const now = new Date();
    const date = new Date(timestamp);
    
    if (isNaN(date.getTime())) {
      // 尝试其他日期格式
      const timestampWithoutMs = timestamp.split('.')[0];
      const date2 = new Date(timestampWithoutMs);
      if (isNaN(date2.getTime())) {
        console.log('无法解析时间戳:', timestamp);
        return '未知时间';
      }
      date = date2;
    }
    
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN');
  } catch (e) {
    console.error('计算时间差错误:', e, '时间戳:', timestamp);
    return '未知时间';
  }
}

// server.js - 添加游戏相关API

// 管理员获取游戏结果API（替换高危预警API）
app.get("/api/admin/tasks", async (req, res) => {
  try {
    // 读取results.csv中的所有游戏结果
    const rawData = fs.readFileSync(resultsPath, 'utf-8');
    const lines = rawData.split('\n').filter(l => l.trim() !== '');
    const tasks = [];
    
    for (let i = 1; i < lines.length; i++) { // 跳过标题行
      const values = parseCsvLine(lines[i]);
      if (values.length >= 4 && values[1] === 'task') { // 只获取游戏数据
        try {
          // 解析JSON数据，注意csv中的JSON是双引号转义的
          let dataStr = values[2];
          // 移除可能的转义字符
          dataStr = dataStr.replace(/\\"/g, '"');
          // 如果字符串以引号开头和结尾，去掉它们
          if (dataStr.startsWith('"') && dataStr.endsWith('"')) {
            dataStr = dataStr.slice(1, -1);
          }
          
          const parsedData = JSON.parse(dataStr);
          
          // 构建task对象
          const task = {
            _id: i,
            username: values[0],
            submittedAt: values[3],
            taskData: parsedData
          };
          
          // 添加任务基本信息
          if (parsedData.taskId) {
            task.taskId = parsedData.taskId;
            task.taskName = getTaskName(parsedData.taskId);
          } else {
            task.taskId = 'Unknown';
            task.taskName = '未知游戏';
          }
          
          // 获取摘要信息
          if (parsedData.summary) {
            task.summary = parsedData.summary;
            task.accuracy = parsedData.summary.accuracy || 0;
            task.meanRT = parsedData.summary.meanRT || 0;
            task.performanceScore = calculatePerformanceScore(parsedData.summary);
          }
          
          // 保存完整的数据用于详情显示
          task.fullData = parsedData;
          
          tasks.push(task);
        } catch (e) {
          console.error('解析游戏数据失败:', e.message, '行数据:', values[2]);
          continue;
        }
      }
    }
    
    return res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取单个游戏的详细信息
app.get("/api/admin/task/:id", async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    
    const rawData = fs.readFileSync(resultsPath, 'utf-8');
    const lines = rawData.split('\n').filter(l => l.trim() !== '');
    
    if (taskId <= 0 || taskId >= lines.length) {
      return res.status(404).json({ error: '游戏记录不存在' });
    }
    
    const values = parseCsvLine(lines[taskId]);
    
    if (values.length < 4 || values[1] !== 'task') {
      return res.status(404).json({ error: '不是有效的游戏记录' });
    }
    
    try {
      // 解析JSON数据
      let dataStr = values[2];
      dataStr = dataStr.replace(/\\"/g, '"');
      if (dataStr.startsWith('"') && dataStr.endsWith('"')) {
        dataStr = dataStr.slice(1, -1);
      }
      
      const parsedData = JSON.parse(dataStr);
      
      const task = {
        _id: taskId,
        username: values[0],
        submittedAt: values[3],
        fullData: parsedData
      };
      
      // 添加任务基本信息
      if (parsedData.taskId) {
        task.taskId = parsedData.taskId;
        task.taskName = getTaskName(parsedData.taskId);
      }
      
      // 获取摘要信息
      if (parsedData.summary) {
        task.summary = parsedData.summary;
        task.performanceScore = calculatePerformanceScore(parsedData.summary);
      }
      
      // 获取配置信息
      if (parsedData.config) {
        task.config = parsedData.config;
      }
      
      // 获取试次数据
      if (parsedData.trials) {
        task.trials = parsedData.trials;
      }
      
      return res.json(task);
    } catch (e) {
      console.error('解析游戏详情失败:', e.message);
      return res.status(500).json({ error: '解析数据失败' });
    }
  } catch (error) {
    console.error('Get task detail error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 辅助函数：根据taskId获取游戏名称
function getTaskName(taskId) {
  const taskNames = {
    'CPT_X': '专注力评估（CPT：X-type）',
    'SST': '停止信号任务（SST）',
    'STROOP': 'Stroop 干扰任务',
    'WCST': 'WCST 卡片分类任务',
    'NBACK': '工作记忆任务（N-back）'
  };
  
  return taskNames[taskId] || taskId;
}

// 辅助函数：计算性能得分
function calculatePerformanceScore(summary) {
  if (!summary) return 0;
  
  let score = 0;
  
  // 准确率贡献（0-50分）
  if (summary.accuracy !== undefined) {
    score += summary.accuracy * 50;
  }
  
  // 命中数贡献（0-20分）
  if (summary.hits !== undefined && summary.n !== undefined) {
    const hitRate = summary.n > 0 ? summary.hits / summary.n : 0;
    score += hitRate * 20;
  }
  
  // 反应时间贡献（0-30分）
  if (summary.meanRT !== undefined) {
    // 假设理想反应时间是400ms，越接近得分越高
    const optimalRT = 400;
    const rtDiff = Math.abs(summary.meanRT - optimalRT);
    const rtScore = Math.max(0, 30 - (rtDiff / 10));
    score += rtScore;
  }
  
  return Math.min(Math.round(score), 100);
}