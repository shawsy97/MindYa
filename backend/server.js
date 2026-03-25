// server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require('bcryptjs');
const puppeteer = require("puppeteer");

require('dotenv').config(); // ← 加载 .env 文件

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
const reportsDir = path.join(dataDir, "reports");
const reportsIndexPath = path.join(reportsDir, "index.json");
const mediaDir = path.join(dataDir, "media");

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
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  if (!fs.existsSync(reportsIndexPath)) {
    fs.writeFileSync(reportsIndexPath, "[]", "utf-8");
  }
  if (!fs.existsSync(mediaDir)) {
    fs.mkdirSync(mediaDir, { recursive: true });
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

const readReportsIndex = () => {
  ensureDataFiles();
  try {
    return JSON.parse(fs.readFileSync(reportsIndexPath, "utf-8"));
  } catch {
    return [];
  }
};

const writeReportsIndex = (index) => {
  fs.writeFileSync(reportsIndexPath, JSON.stringify(index, null, 2), "utf-8");
};

const getMimeType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".m4a") return "audio/mp4";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".m3u8") return "application/vnd.apple.mpegurl";
  if (ext === ".ts") return "video/mp2t";
  return "application/octet-stream";
};

const safeJoin = (base, ...parts) => {
  const target = path.normalize(path.join(base, ...parts));
  if (!target.startsWith(base)) return null;
  return target;
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

const safeParseJson = (raw) => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    try {
      let dataStr = raw.replace(/\\"/g, '"');
      if (dataStr.startsWith('"') && dataStr.endsWith('"')) {
        dataStr = dataStr.slice(1, -1);
      }
      return JSON.parse(dataStr);
    } catch {
      return null;
    }
  }
};

const getProfileByUsername = (username) => {
  ensureDataFiles();
  const content = fs.readFileSync(profilesPath, "utf-8");
  const profiles = parseCsv(content);
  return profiles.rows.find((row) => row.username === username) || null;
};

const getScaleResultsByUsername = (username) => {
  ensureDataFiles();
  const rawData = fs.readFileSync(resultsPath, "utf-8");
  const lines = rawData.split("\n").filter((l) => l.trim() !== "");
  const results = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    if (values.length >= 4 && values[1] === "scale" && values[0] === username) {
      const parsed = safeParseJson(values[2]);
      if (parsed) {
        results.push({
          username: values[0],
          createdAt: values[3],
          data: parsed,
        });
      }
    }
  }
  return results;
};

const getTaskResultsByUsername = (username) => {
  ensureDataFiles();
  const rawData = fs.readFileSync(resultsPath, "utf-8");
  const lines = rawData.split("\n").filter((l) => l.trim() !== "");
  const results = [];
  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i]);
    if (values.length >= 4 && values[1] === "task" && values[0] === username) {
      const parsed = safeParseJson(values[2]);
      if (parsed) {
        results.push({
          username: values[0],
          createdAt: values[3],
          data: parsed,
        });
      }
    }
  }
  return results;
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
    'SAS': '焦虑自评量表',
    'ERQ': '情绪调节问卷',
    'NET_ADDICT': '青少年上网成瘾自评量表',
    'BULLYING_SIMPLE': '同伴相处小问答',
    'PHQ9_CHILD': 'PHQ-9 抑郁量表'
  };

  return scaleNames[scaleId] || scaleId;
}

const getThemeScaleMap = (ageNumber) => {
  const isLowAge = ageNumber === 8 || ageNumber === 9;
  return {
    emotion_forest: isLowAge ? ["PHQ9_CHILD"] : ["DASS21", "ANHEDONIA", "ERQ"],
    digital_island: ["NET_ADDICT"],
    stress_sea: ["ACADEMIC_BURNOUT", "SCHOOL_AVERSION"],
    confidence_garden: isLowAge ? ["BULLYING_SIMPLE"] : ["BULLYING"],
    sleep_planet: ["SRSS"],
  };
};

const getLatestScalesById = (scaleResults) => {
  const latest = {};
  for (const r of scaleResults) {
    const scaleId = r.data?.scaleId;
    if (!scaleId) continue;
    if (!latest[scaleId] || latest[scaleId].createdAt < r.createdAt) {
      latest[scaleId] = r;
    }
  }
  return latest;
};

const getLatestTasksById = (taskResults) => {
  const latest = {};
  for (const r of taskResults) {
    const taskId = r.data?.taskId;
    if (!taskId) continue;
    if (!latest[taskId] || latest[taskId].createdAt < r.createdAt) {
      latest[taskId] = r;
    }
  }
  return latest;
};

const parseDateSafe = (value) => {
  const ts = Date.parse(value);
  return Number.isNaN(ts) ? null : new Date(ts);
};

const summarizeTrend = (items, valueGetter) => {
  const sorted = [...items].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const recent3 = sorted.slice(-3).map((it) => ({
    at: it.createdAt,
    value: valueGetter(it),
  }));

  const now = Date.now();
  const avgWithin = (days) => {
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    const values = sorted
      .map((it) => ({ date: parseDateSafe(it.createdAt), value: valueGetter(it) }))
      .filter((it) => it.date && it.date.getTime() >= cutoff && typeof it.value === "number");
    if (!values.length) return null;
    const sum = values.reduce((acc, it) => acc + it.value, 0);
    return Number((sum / values.length).toFixed(2));
  };

  return {
    recent3,
    avg7d: avgWithin(7),
    avg30d: avgWithin(30),
  };
};

const getDASSSeverityRank = (label) => {
  const map = {
    "正常": 0,
    "轻度": 1,
    "中度": 2,
    "重度": 3,
    "极重度": 4,
  };
  return map[label] ?? -1;
};

const detectSelfHarmSignals = (text) => {
  if (!text) return false;
  const patterns = [
    "不想活",
    "活着没意思",
    "想消失",
    "想伤害自己",
    "想结束",
    "自伤",
    "自杀",
    "结束生命",
  ];
  return patterns.some((p) => text.includes(p));
};

const calcSuicideRiskStage = ({ latestScales, latestTasks, userText }) => {
  const signals = [];
  const phq9 = latestScales.PHQ9_CHILD?.data;
  const dass = latestScales.DASS21?.data;
  const srs = latestScales.SRSS?.data;
  const bullying = latestScales.BULLYING?.data || latestScales.BULLYING_SIMPLE?.data;
  const burnout = latestScales.ACADEMIC_BURNOUT?.data;
  const aversion = latestScales.SCHOOL_AVERSION?.data;

  const phq9Total = Number(phq9?.score?.total);
  const phq9Item9 = Number(phq9?.score?.item9);
  const dassDepRank = getDASSSeverityRank(dass?.level?.depression);
  const dassAnxRank = getDASSSeverityRank(dass?.level?.anxiety);
  const dassStressRank = getDASSSeverityRank(dass?.level?.stress);
  const srsLevel = srs?.level?.total || "";
  const srsModeratePlus = srsLevel.includes("中度") || srsLevel.includes("重度");
  const bullyingConcern = Boolean(bullying?.flags?.hasConcern || bullying?.flags?.victim || bullying?.flags?.bully);

  const moderateScaleCount = [
    phq9Total >= 10,
    dassDepRank >= 2,
    srsModeratePlus,
    bullyingConcern,
    aversion?.flags?.riskLevel === "medium" || aversion?.flags?.riskLevel === "high",
  ].filter(Boolean).length;

  const directSignal = detectSelfHarmSignals(userText);
  if (directSignal) {
    signals.push("user_direct_signal");
  }
  if (phq9Total >= 20 || dassDepRank >= 3) {
    signals.push("severe_mood_scale");
  }

  if (directSignal || phq9Total >= 20 || dassDepRank >= 3) {
    return { stage: 3, signals };
  }

  const stage2Triggers = [];
  if (phq9Total >= 10 && phq9Item9 > 0) stage2Triggers.push("phq9_item9");
  if (dassDepRank >= 2) stage2Triggers.push("dass_depression_moderate");
  if (dassAnxRank >= 3 || dassStressRank >= 3) stage2Triggers.push("dass_anx_stress_severe");
  if (srsModeratePlus) stage2Triggers.push("sleep_moderate");
  if (bullyingConcern) stage2Triggers.push("bullying");
  if (moderateScaleCount >= 2) stage2Triggers.push("multi_domain");
  if (burnout?.score?.mean >= 3) stage2Triggers.push("burnout_mean_high");
  if (aversion?.flags?.riskLevel === "medium" || aversion?.flags?.riskLevel === "high") stage2Triggers.push("school_aversion");

  if (stage2Triggers.length) {
    return { stage: 2, signals: stage2Triggers };
  }

  return { stage: 1, signals: [] };
};

const extractJsonBlock = (text) => {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
};

const callReportAI = async (input) => {
  if (!process.env.DASHSCOPE_API_KEY) return null;
  const model = process.env.DASHSCOPE_MODEL || "qwen-max";
  const system = [
    "你是心理报告撰写助手，请根据输入量表数据生成报告解读。",
    "输出必须是 JSON，且只包含以下字段：",
    "overallConclusion, themeSummaries, scaleInterpretations, riskWarnings, comprehensiveAnalysis, interventions。",
    "overallConclusion 包含 stableAreas, attentionAreas, highRiskAreas。",
    "themeSummaries 为主题名到简短总结的映射。",
    "scaleInterpretations 为 scaleId 到解释文字的映射。",
    "interventions 包含 daily, homeSchool, professional 三个字段。",
    "用中文，避免诊断性结论，强调支持性建议。",
  ].join("\n");

  const user = `输入数据：\n${JSON.stringify(input)}`;

  const resp = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.DASHSCOPE_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
    }),
  });

  if (!resp.ok) {
    return null;
  }
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || "";
  return extractJsonBlock(text);
};

const RELAX_RESOURCE_CATALOG = [
  { name: "放松空间总览", link: "#relax" },
  { name: "儿童冥想 · 正念大叔", link: "#relax-meditation" },
  { name: "脑波音乐 · 频段列表", link: "#relax-binaural" },
];

const callStatusAI = async (input) => {
  if (!process.env.DASHSCOPE_API_KEY) return null;
  const model = process.env.DASHSCOPE_MODEL || "qwen-max";
  const system = [
    "你是心理健康陪伴系统的分析助手。",
    "根据输入的量表与任务结果，生成当前状态摘要与对话追问建议。",
    "输出必须是 JSON，且只包含以下字段：",
    "statusSummary, keySignals, suggestedQuestions, supportSuggestions, resourceRecommendations。",
    "statusSummary 为简短中文摘要（2-4 句）。",
    "keySignals 为数组，列出当前主要风险/优势要点。",
    "suggestedQuestions 为数组，2-4 条柔性追问。",
    "supportSuggestions 为数组，2-4 条支持性建议（不含诊断）。",
    "resourceRecommendations 为数组，仅可从给定资源库中选择，并返回 {name, link, reason}。",
    "如果资源库不合适，请返回空数组。",
    "避免诊断性措辞。",
    `资源库：${JSON.stringify(RELAX_RESOURCE_CATALOG)}`,
  ].join("\n");

  const user = `输入数据：\n${JSON.stringify(input)}`;
  const resp = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.DASHSCOPE_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.4,
    }),
  });

  if (!resp.ok) return null;
  const data = await resp.json();
  const text = data?.choices?.[0]?.message?.content || "";
  return extractJsonBlock(text);
};

const buildReportData = async (username) => {
  const profile = getProfileByUsername(username) || {};
  const ageNumber = Number(String(profile.age || "").replace(/[^\d]/g, ""));
  const themeMap = getThemeScaleMap(ageNumber);
  const scaleResults = getScaleResultsByUsername(username);
  const latestScales = getLatestScalesById(scaleResults);

  const scalesPayload = {};
  Object.keys(latestScales).forEach((scaleId) => {
    const item = latestScales[scaleId];
    const rawScore = item.data?.score || {};
    let score = { ...rawScore };
    if (scaleId === "ERQ") {
      const supMean = Number(rawScore.suppression_mean);
      if (!Number.isNaN(supMean)) {
        score = {
          ...score,
          suppression_reverse_mean: Number((8 - supMean).toFixed(2)),
        };
      }
    }
    scalesPayload[scaleId] = {
      scaleId,
      scaleName: getScaleName(scaleId),
      createdAt: item.createdAt,
      score,
      level: item.data?.level || {},
      flags: item.data?.flags || {},
      answers: item.data?.answers || {},
    };
  });

  const aiInput = {
    profile: {
      username,
      age: profile.age || "",
      grade: profile.grade || "",
      gender: profile.gender || "",
    },
    themes: themeMap,
    scales: scalesPayload,
  };

  const aiResult = await callReportAI(aiInput);

  const content = {
    overallConclusion: aiResult?.overallConclusion || {
      stableAreas: "",
      attentionAreas: "",
      highRiskAreas: "",
    },
    themeSummaries: aiResult?.themeSummaries || {},
    scaleInterpretations: aiResult?.scaleInterpretations || {},
    riskWarnings: aiResult?.riskWarnings || "",
    comprehensiveAnalysis: aiResult?.comprehensiveAnalysis || "",
    interventions: aiResult?.interventions || {
      daily: "保持规律作息\n控制夜间电子产品使用\n增加运动与户外活动\n鼓励表达情绪与寻求支持",
      homeSchool: "家长保持非指责式沟通\n班主任关注课堂状态与同伴互动\n必要时安排心理老师随访",
      professional: "若风险持续或加重，建议进一步专业评估\n若出现明显危机信号，应尽快联系专业心理/医疗资源",
    },
    notes:
      "本报告为自动生成的筛查性反馈，最终解释需由专业人员结合实际情况完成。",
  };

  return {
    id: `${username}_${Date.now()}`,
    username,
    version: "v1",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    profile: {
      username,
      age: profile.age || "",
      grade: profile.grade || "",
      gender: profile.gender || "",
    },
    themeMap,
    scales: scalesPayload,
    content,
  };
};

const getScaleValueForTrend = (scaleData) => {
  if (!scaleData) return null;
  const score = scaleData.score || {};
  if (typeof score.total === "number") return score.total;
  if (typeof score.mean === "number") return score.mean;
  if (typeof score.depression === "number" && typeof score.anxiety === "number" && typeof score.stress === "number") {
    return score.depression + score.anxiety + score.stress;
  }
  if (typeof score.reappraisal_mean === "number") return score.reappraisal_mean;
  if (typeof score.suppression_mean === "number") return score.suppression_mean;
  return null;
};

const getTaskValueForTrend = (taskData) => {
  if (!taskData) return null;
  const summary = taskData.summary || {};
  if (typeof summary.accuracy === "number") return summary.accuracy;
  if (typeof summary.meanRT === "number") return summary.meanRT;
  return null;
};

const buildAiContextData = async (username, userText = "") => {
  const profile = getProfileByUsername(username) || {};
  const scaleResults = getScaleResultsByUsername(username);
  const taskResults = getTaskResultsByUsername(username);
  const latestScales = getLatestScalesById(scaleResults);
  const latestTasks = getLatestTasksById(taskResults);

  const scalesPayload = {};
  Object.keys(latestScales).forEach((scaleId) => {
    const item = latestScales[scaleId];
    scalesPayload[scaleId] = {
      scaleId,
      scaleName: getScaleName(scaleId),
      createdAt: item.createdAt,
      score: item.data?.score || {},
      level: item.data?.level || {},
      flags: item.data?.flags || {},
    };
  });

  const tasksPayload = {};
  Object.keys(latestTasks).forEach((taskId) => {
    const item = latestTasks[taskId];
    tasksPayload[taskId] = {
      taskId,
      createdAt: item.createdAt,
      summary: item.data?.summary || {},
    };
  });

  const scaleTrends = {};
  const scaleById = {};
  for (const r of scaleResults) {
    const scaleId = r.data?.scaleId;
    if (!scaleId) continue;
    if (!scaleById[scaleId]) scaleById[scaleId] = [];
    scaleById[scaleId].push(r);
  }
  Object.keys(scaleById).forEach((scaleId) => {
    scaleTrends[scaleId] = summarizeTrend(scaleById[scaleId], (it) => getScaleValueForTrend(it.data));
  });

  const taskTrends = {};
  const taskById = {};
  for (const r of taskResults) {
    const taskId = r.data?.taskId;
    if (!taskId) continue;
    if (!taskById[taskId]) taskById[taskId] = [];
    taskById[taskId].push(r);
  }
  Object.keys(taskById).forEach((taskId) => {
    taskTrends[taskId] = summarizeTrend(taskById[taskId], (it) => getTaskValueForTrend(it.data));
  });

  const risk = calcSuicideRiskStage({
    latestScales,
    latestTasks,
    userText,
  });

  const aiInput = {
    profile: {
      username,
      age: profile.age || "",
      grade: profile.grade || "",
      gender: profile.gender || "",
    },
    scales: scalesPayload,
    tasks: tasksPayload,
    trends: {
      scales: scaleTrends,
      tasks: taskTrends,
    },
    riskStage: risk,
  };

  const aiSummary = await callStatusAI(aiInput);

  return {
    profile: aiInput.profile,
    scales: scalesPayload,
    tasks: tasksPayload,
    trends: aiInput.trends,
    risk,
    aiSummary,
  };
};

const renderReportHtml = (report) => {
  const profile = report.profile || {};
  const content = report.content || {};
  const themeSummaries = content.themeSummaries || {};
  const scaleInterpretations = content.scaleInterpretations || {};

  const themeRows = [
    ["情绪森林", "情绪状态", themeSummaries.emotion_forest || ""],
    ["数字小岛", "网络使用", themeSummaries.digital_island || ""],
    ["学海破浪/鸭梨海", "学业与压力", themeSummaries.stress_sea || ""],
    ["自信花园", "自我认同与人际", themeSummaries.confidence_garden || ""],
    ["睡眠星球", "睡眠与恢复", themeSummaries.sleep_planet || ""],
  ];

  const renderScale = (scaleId) => {
    const scale = report.scales?.[scaleId];
    if (!scale) return "";
    const score = scale.score || {};
    const level = scale.level || {};
    const interp = scaleInterpretations[scaleId] || "";
    const extraLines = [];
    if (scaleId === "DASS21") {
      extraLines.push(`抑郁：${score.depression ?? "-" }（${level.depression || "-"})`);
      extraLines.push(`焦虑：${score.anxiety ?? "-" }（${level.anxiety || "-"})`);
      extraLines.push(`压力：${score.stress ?? "-" }（${level.stress || "-"})`);
    }
    if (scaleId === "PHQ9_CHILD") {
      extraLines.push(`第9题：${score.item9 ?? "-"}`);
      extraLines.push(`分级：${level.severity || "-"}`);
    }
    if (scaleId === "ANHEDONIA") {
      extraLines.push(`总分：${score.total ?? "-"}`);
      extraLines.push(`平均分：${score.mean ?? "-"}`);
    }
    if (scaleId === "ERQ") {
      extraLines.push(`认知重评分：${score.reappraisal_mean ?? "-"}`);
      extraLines.push(`表达抑制分：${score.suppression_mean ?? "-"}`);
      if (score.suppression_reverse_mean !== undefined) {
        extraLines.push(`表达抑制分（反向）：${score.suppression_reverse_mean}`);
      }
    }
    if (scaleId === "NET_ADDICT") {
      extraLines.push(`总分：${score.total ?? "-"}`);
      extraLines.push(`症状维度：${score.symptom ?? "-"}`);
      extraLines.push(`诱因维度：${score.cause ?? "-"}`);
      extraLines.push(`阈值：${score.threshold ?? 45}`);
    }
    if (scaleId === "ACADEMIC_BURNOUT") {
      extraLines.push(`总分：${score.total ?? "-"}`);
      extraLines.push(`均分：${score.mean ?? "-"}`);
    }
    if (scaleId === "SCHOOL_AVERSION") {
      extraLines.push(`均分：${score.mean ?? "-"}`);
      extraLines.push(`分级：${level.total || "-"}`);
    }
    if (scaleId === "BULLYING" || scaleId === "BULLYING_SIMPLE") {
      extraLines.push(`结果分类：${level.role || level.summary || "-"}`);
    }
    if (scaleId === "SRSS") {
      extraLines.push(`总分：${score.total ?? "-"}`);
      extraLines.push(`分级：${level.total || "-"}`);
    }
    return `
      <div class="section">
        <div class="section-title">${scale.scaleName || scaleId}</div>
        <div class="section-body">
          <div>总分：${score.total ?? "-"}</div>
          <div>分级：${level.severity || level.status || level.total || "-"}</div>
          ${extraLines.map((l) => `<div>${l}</div>`).join("")}
          <div class="text-block">解释：${interp || "-"}</div>
        </div>
      </div>
    `;
  };

  return `
  <html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body { font-family: "Helvetica Neue", Arial, sans-serif; color: #333; margin: 24px; }
      h1, h2, h3 { margin: 0 0 8px; }
      .cover { border-bottom: 2px solid #eee; padding-bottom: 16px; margin-bottom: 24px; }
      .section { margin-bottom: 20px; }
      .section-title { font-weight: 700; margin-bottom: 6px; }
      .table { width: 100%; border-collapse: collapse; }
      .table th, .table td { border: 1px solid #ddd; padding: 6px 8px; font-size: 12px; }
      .text-block { white-space: pre-wrap; margin-top: 6px; }
      .muted { color: #666; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="cover">
      <h1>成长探索心理测评专业报告</h1>
      <div class="muted">受测者编号：${report.username}</div>
      <div class="muted">姓名/昵称：${report.username}</div>
      <div class="muted">年龄：${profile.age || "-"}</div>
      <div class="muted">年级：${profile.grade || "-"}</div>
      <div class="muted">性别：${profile.gender || "-"}</div>
      <div class="muted">测评日期：${report.createdAt?.split("T")[0] || "-"}</div>
      <div class="muted">报告生成日期：${report.updatedAt?.split("T")[0] || "-"}</div>
      <div class="muted">报告版本：${report.version}</div>
      <div class="muted">本报告用于心理健康筛查、成长支持与教育辅导参考，不作为医学诊断或临床诊断依据。</div>
    </div>

    <div class="section">
      <h2>总体概览</h2>
      <table class="table">
        <thead><tr><th>主题</th><th>心理维度</th><th>备注</th></tr></thead>
        <tbody>
          ${themeRows.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2] || "-"}</td></tr>`).join("")}
        </tbody>
      </table>
      <div class="text-block">相对稳定领域：${content.overallConclusion?.stableAreas || "-"}</div>
      <div class="text-block">建议关注领域：${content.overallConclusion?.attentionAreas || "-"}</div>
      <div class="text-block">重点关注领域：${content.overallConclusion?.highRiskAreas || "-"}</div>
    </div>

    <div class="section">
      <h2>分主题结果详情</h2>
      ${renderScale("DASS21")}
      ${renderScale("PHQ9_CHILD")}
      ${renderScale("ANHEDONIA")}
      ${renderScale("ERQ")}
      ${renderScale("NET_ADDICT")}
      ${renderScale("ACADEMIC_BURNOUT")}
      ${renderScale("SCHOOL_AVERSION")}
      ${renderScale("BULLYING")}
      ${renderScale("BULLYING_SIMPLE")}
      ${renderScale("SRSS")}
    </div>

    <div class="section">
      <h2>风险预警</h2>
      <div class="text-block">${content.riskWarnings || "-"}</div>
    </div>

    <div class="section">
      <h2>综合分析</h2>
      <div class="text-block">${content.comprehensiveAnalysis || "-"}</div>
    </div>

    <div class="section">
      <h2>干预建议</h2>
      <div class="text-block">${content.interventions?.daily || "-"}</div>
      <div class="text-block">${content.interventions?.homeSchool || "-"}</div>
      <div class="text-block">${content.interventions?.professional || "-"}</div>
    </div>

    <div class="section">
      <h2>报告尾注</h2>
      <div class="text-block">${content.notes || "-"}</div>
    </div>
  </body>
  </html>
  `;
};

const generateReportPdf = async (report, pdfPath) => {
  const html = renderReportHtml(report);
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({ path: pdfPath, format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }
};

// 管理员：报告查询与生成
app.get("/api/admin/report/user/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const index = readReportsIndex();
    const reports = index.filter((r) => r.username === username);
    return res.json({ reports });
  } catch (error) {
    console.error("Get reports error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/admin/report/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const index = readReportsIndex();
    const record = index.find((r) => r.id === id);
    if (!record) return res.status(404).json({ error: "Report not found" });
    const report = JSON.parse(fs.readFileSync(record.jsonPath, "utf-8"));
    return res.json(report);
  } catch (error) {
    console.error("Get report error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/admin/report/generate", async (req, res) => {
  try {
    const { username } = req.body || {};
    if (!username) return res.status(400).json({ error: "Missing username" });

    const report = await buildReportData(username);
    const jsonPath = path.join(reportsDir, `${report.id}.json`);
    const pdfPath = path.join(reportsDir, `${report.id}.pdf`);
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf-8");

    const index = readReportsIndex();
    index.unshift({
      id: report.id,
      username,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      jsonPath,
      pdfPath,
    });
    writeReportsIndex(index);

    return res.json(report);
  } catch (error) {
    console.error("Generate report error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/api/admin/report/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body || {};
    const index = readReportsIndex();
    const record = index.find((r) => r.id === id);
    if (!record) return res.status(404).json({ error: "Report not found" });

    const report = JSON.parse(fs.readFileSync(record.jsonPath, "utf-8"));
    report.content = content || report.content;
    report.updatedAt = new Date().toISOString();
    fs.writeFileSync(record.jsonPath, JSON.stringify(report, null, 2), "utf-8");

    record.updatedAt = report.updatedAt;
    writeReportsIndex(index);

    return res.json(report);
  } catch (error) {
    console.error("Update report error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/admin/report/:id/pdf", async (req, res) => {
  try {
    const { id } = req.params;
    const index = readReportsIndex();
    const record = index.find((r) => r.id === id);
    if (!record) return res.status(404).json({ error: "Report not found" });

    if (!fs.existsSync(record.pdfPath)) {
      const report = JSON.parse(fs.readFileSync(record.jsonPath, "utf-8"));
      await generateReportPdf(report, record.pdfPath);
    }

    res.setHeader("Content-Type", "application/pdf");
    return res.sendFile(record.pdfPath);
  } catch (error) {
    console.error("Generate report pdf error:", error);
    return res.status(500).json({ error: "Internal server error" });
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

app.get("/api/profile/:username", async (req, res) => {
  try {
    const { username } = req.params || {};
    if (!username) {
      return res.status(400).json({ error: "Missing username" });
    }

    const profilesContent = fs.readFileSync(profilesPath, 'utf-8');
    const profiles = parseCsv(profilesContent);
    const found = profiles.rows.find((row) => row.username === username);

    if (!found) {
      return res.status(404).json({ error: "Profile not found" });
    }

    return res.json({
      username: found.username,
      gender: found.gender || '',
      age: found.age || '',
      grade: found.grade || '',
    });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 媒体资源列表（基础鉴权：仅要求有效用户名）
app.get("/api/media/list/*", async (req, res) => {
  try {
    const { username } = req.query || {};
    if (!username) {
      return res.status(401).json({ error: "Missing username" });
    }
    const users = readUsers();
    const exists = users.some((u) => u.username === username);
    if (!exists) {
      return res.status(403).json({ error: "Invalid user" });
    }

    const subPath = req.params[0] || "";
    const dirPath = safeJoin(mediaDir, subPath);
    if (!dirPath || !fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      return res.status(404).json({ error: "Directory not found" });
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const files = entries
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .filter((name) => /\.(mp3|m4a|wav|mp4|webm|m3u8)$/i.test(name))
      .map((name) => ({
        name,
        path: subPath ? `${subPath}/${name}` : name,
      }));

    const dirItems = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .map((dirName) => {
        const dirFull = path.join(dirPath, dirName);
        const subEntries = fs.readdirSync(dirFull);
        let m3u8Name = subEntries.find((n) => n.toLowerCase() === "index.m3u8");
        if (!m3u8Name) {
          m3u8Name = subEntries.find((n) => n.toLowerCase().endsWith(".m3u8"));
        }
        if (!m3u8Name) return null;
        const fullPath = subPath ? `${subPath}/${dirName}/${m3u8Name}` : `${dirName}/${m3u8Name}`;
        return { name: dirName, path: fullPath };
      })
      .filter(Boolean);

    const allItems = [...dirItems, ...files];

    allItems.sort((a, b) => {
      const aMatch = a.name.match(/第(\d+)集|ep(\d+)/i);
      const bMatch = b.name.match(/第(\d+)集|ep(\d+)/i);
      const aNum = aMatch ? Number(aMatch[1] || aMatch[2]) : NaN;
      const bNum = bMatch ? Number(bMatch[1] || bMatch[2]) : NaN;
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
        return aNum - bNum;
      }
      return a.name.localeCompare(b.name, 'zh-CN');
    });

    return res.json({ files: allItems });
  } catch (error) {
    console.error("Media list error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// 媒体资源（基础鉴权：仅要求有效用户名）
app.get("/api/media/*", async (req, res) => {
  try {
    const { username } = req.query || {};
    if (!username) {
      return res.status(401).json({ error: "Missing username" });
    }
    const users = readUsers();
    const exists = users.some((u) => u.username === username);
    if (!exists) {
      return res.status(403).json({ error: "Invalid user" });
    }

    const subPath = req.params[0] || "";
    const filePath = safeJoin(mediaDir, subPath);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const stat = fs.statSync(filePath);
    const range = req.headers.range;
    const filename = path.basename(filePath);
    const mimeType = getMimeType(filename);

    if (path.extname(filename).toLowerCase() === ".m3u8") {
      const raw = fs.readFileSync(filePath, "utf-8");
      const patched = raw
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) return line;
          const sep = trimmed.includes("?") ? "&" : "?";
          return `${trimmed}${sep}username=${encodeURIComponent(username)}`;
        })
        .join("\n");
      res.writeHead(200, { "Content-Type": mimeType });
      res.end(patched);
      return;
    }

    if (range) {
      const [startStr, endStr] = range.replace(/bytes=/, "").split("-");
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : stat.size - 1;
      const chunkSize = end - start + 1;
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": mimeType,
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      "Content-Length": stat.size,
      "Content-Type": mimeType,
    });
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error("Media error:", error);
    return res.status(500).json({ error: "Internal server error" });
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

app.get("/api/ai/context", async (req, res) => {
  try {
    const { username } = req.query || {};
    if (!username) {
      return res.status(400).json({ error: "Missing username" });
    }
    const context = await buildAiContextData(username);
    appendSystemLog({
      type: "system",
      event: "ai_context_generated",
      endpoint: "/api/ai/context",
      username,
      risk_stage: context?.risk?.stage,
    });
    return res.json(context);
  } catch (error) {
    console.error("AI context error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/chat", async (req, res) => {
  console.log("🚀 DASHSCOPE_API_KEY loaded:", process.env.DASHSCOPE_API_KEY ? "YES" : "MISSING!");
  if (process.env.DASHSCOPE_API_KEY) {
    console.log("🔑 Key prefix:", process.env.DASHSCOPE_API_KEY.substring(0, 8));
  }
  try {
    if (!process.env.DASHSCOPE_API_KEY) {
      appendSystemLog({
        type: "system",
        event: "api_error",
        endpoint: "/api/chat",
        status: 500,
        error_code: "MISSING_DASHSCOPE_API_KEY",
      });
      return res.status(500).json({ error: "Missing DASHSCOPE_API_KEY" });
    }

    const chatStart = Date.now();
    const { messages, userProfile, role, context } = req.body;
    const username = req.body?.username || userProfile?.username;
    const model = process.env.DASHSCOPE_MODEL || "qwen-max";
    const lastUserText = Array.isArray(messages)
      ? [...messages].reverse().find((m) => m.role === "user")?.content
      : "";
    const computedContext = context || (username ? await buildAiContextData(username, lastUserText) : null);
    const riskStage = computedContext?.risk?.stage || 1;
    const riskSignals = computedContext?.risk?.signals || [];
    const aiSummary = computedContext?.aiSummary || {};
    const resourceCatalog = RELAX_RESOURCE_CATALOG;

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

# 当前状态摘要
${aiSummary?.statusSummary || "暂无自动摘要。"}

# 关键提示
${Array.isArray(aiSummary?.keySignals) ? aiSummary.keySignals.map((x) => `- ${x}`).join("\n") : ""}

# 推荐资源库（只能从此列表中选择）
${resourceCatalog.map((r) => `- ${r.name}：${r.link}`).join("\n")}

# 自伤风险分级策略
当前分级：${riskStage}；信号：${riskSignals.join(", ") || "无"}。
一级（不主动问）：整体低风险时，不直接问自伤相关问题。
二级（柔性探索）：当出现中度及以上情绪/睡眠/厌学/欺凌等风险时，先以关怀式追问，例如：
“当情绪很难受的时候，你一般会怎么应对？”“最近有没有出现过很强烈的无助感或想逃开的感觉？”
三级（直接筛查）：当用户表达明显绝望/自伤想法，或量表显示重度风险时，直接问：
“我想认真确认一件事：最近有没有出现过伤害自己的想法？”
“最近有没有想过不想活了，或者希望自己消失？”
如果用户回答“有”，继续问频率、是否想过方式、是否准备过工具、是否一个人、是否有可信任的大人。

# 输出要求
1. 先用 1-2 句解释当前状态（非诊断）。
2. 追加 1-2 个温和追问（根据风险分级）。
3. 给出 1-3 条可执行建议。
4. 如适合，给出 1-2 条资源推荐，必须使用上面的链接。
`;

    // 2) 调用 DashScope OpenAI 兼容接口
    const resp = await fetch("https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DASHSCOPE_API_KEY}`,
      },
      body: JSON.stringify({
        model,        // 你可换成你开通的模型
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
        detail: errText,
      });
      return res.status(resp.status).json({ error: "Upstream error", detail: errText });
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
    // 对话统计数据
    const conversationStats = {
      totalMessages: 0,          // 总消息数
      todayMessages: 0,          // 当天消息数
      totalConversations: 0,     // 总会话数
      todayConversations: 0,     // 当天会话数
      totalUsers: 0,             // 总聊天用户数
      todayUsers: 0              // 当天聊天用户数
    };

    // 计算对话统计
    try {
      // 读取对话数据
      const conversationsData = readConversations();
      const today = new Date().toISOString().split('T')[0];
      const userSet = new Set();      // 总聊天用户集合
      const todayUserSet = new Set(); // 当天聊天用户集合

      // 遍历所有对话
      for (const [username, userConversations] of Object.entries(conversationsData)) {
        if (Array.isArray(userConversations)) {
          userSet.add(username); // 添加用户到集合

          for (const conversation of userConversations) {
            if (conversation && conversation.messages) {
              const messageCount = conversation.messages.length || 0;
              conversationStats.totalMessages += messageCount;
              conversationStats.totalConversations += 1;

              // 判断是否为当天对话
              let isToday = false;
              if (conversation.updatedAt) {
                const convoDate = new Date(conversation.updatedAt).toISOString().split('T')[0];
                isToday = convoDate === today;
              } else if (conversation.messages && conversation.messages.length > 0) {
                // 使用最后一条消息的时间
                const lastMsg = conversation.messages[conversation.messages.length - 1];
                if (lastMsg.timestamp) {
                  const convoDate = new Date(lastMsg.timestamp).toISOString().split('T')[0];
                  isToday = convoDate === today;
                }
              }

              if (isToday) {
                conversationStats.todayMessages += messageCount;
                conversationStats.todayConversations += 1;
                todayUserSet.add(username);
              }
            }
          }
        }
      }

      conversationStats.totalUsers = userSet.size;
      conversationStats.todayUsers = todayUserSet.size;
    } catch (error) {
      console.error('计算对话统计出错:', error);
    }
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
      conversations: conversationStats,  // 添加对话统计
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
