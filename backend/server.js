// server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require('bcryptjs');
const puppeteer = require("puppeteer");
const crypto = require("crypto");
const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

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
const profilesJsonPath = path.join(dataDir, "profiles.json");
const resultsPath = path.join(dataDir, "results.csv");
const resultsJsonlPath = path.join(dataDir, "results.jsonl");
const logsPath = path.join(dataDir, "logs.csv");
const systemLogPath = path.join(dataDir, "system_logs.jsonl");
const conversationsPath = path.join(dataDir, "conversations.json");
const reportsDir = path.join(dataDir, "reports");
const reportsIndexPath = path.join(reportsDir, "index.json");
const mediaDir = path.join(dataDir, "media");
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || "";
const R2_BUCKET = process.env.R2_BUCKET || "";
const R2_MEDIA_PREFIX = process.env.R2_MEDIA_PREFIX || "media";
const R2_REPORTS_PREFIX = process.env.R2_REPORTS_PREFIX || "reports";
const R2_PUBLIC_BASE =
  process.env.R2_PUBLIC_BASE ||
  (R2_BUCKET && R2_ACCOUNT_ID ? `https://${R2_BUCKET}.${R2_ACCOUNT_ID}.r2.dev` : "");
const R2_ENABLED = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET);
const D1_ACCOUNT_ID = process.env.D1_ACCOUNT_ID || "";
const D1_DATABASE_ID = process.env.D1_DATABASE_ID || "";
const D1_API_TOKEN = process.env.D1_API_TOKEN || "";
const D1_ENABLED = Boolean(D1_ACCOUNT_ID && D1_DATABASE_ID && D1_API_TOKEN);
const D1_API_BASE = `https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}`;

const getR2Client = () => {
  if (!R2_ENABLED) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    forcePathStyle: true,
  });
};

const d1Query = async (sql, params = []) => {
  if (!D1_ENABLED) throw new Error("D1 not configured");
  const resp = await fetch(`${D1_API_BASE}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${D1_API_TOKEN}`,
    },
    body: JSON.stringify({ sql, params }),
  });
  const data = await resp.json();
  if (!data?.success) {
    const detail = data?.errors?.[0]?.message || "D1 error";
    throw new Error(detail);
  }
  return data?.result?.[0] || {};
};

const d1Exec = async (sql, params = []) => {
  await d1Query(sql, params);
};

const initD1Tables = async () => {
  if (!D1_ENABLED) return;
  await d1Exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    email TEXT,
    password_hash TEXT,
    status TEXT,
    created_at TEXT,
    updated_at TEXT
  )`);
  await d1Exec(`CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    username TEXT,
    nickname TEXT,
    avatar_url TEXT,
    bio TEXT,
    gender TEXT,
    birthday TEXT,
    age TEXT,
    grade TEXT,
    scale_result TEXT,
    model_result TEXT,
    game_result TEXT,
    created_at TEXT,
    updated_at TEXT
  )`);
  await d1Exec(`CREATE TABLE IF NOT EXISTS results (
    id TEXT PRIMARY KEY,
    username TEXT,
    type TEXT,
    data TEXT,
    created_at TEXT
  )`);
  await d1Exec(`CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    username TEXT,
    title TEXT,
    preview TEXT,
    created_at TEXT,
    updated_at TEXT
  )`);
  await d1Exec(`CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    role TEXT,
    content TEXT,
    created_at TEXT
  )`);
};

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
  if (!fs.existsSync(profilesJsonPath)) {
    fs.writeFileSync(profilesJsonPath, "[]", "utf-8");
  }
  if (!fs.existsSync(resultsPath)) {
    fs.writeFileSync(resultsPath, "username,type,data,createdAt\n", "utf-8");
  }
  if (!fs.existsSync(resultsJsonlPath)) {
    fs.writeFileSync(resultsJsonlPath, "", "utf-8");
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

const getUserByUsername = async (username) => {
  if (!username) return null;
  const users = readUsers();
  const local = users.find((u) => u.username === username);
  if (local) return local;
  if (D1_ENABLED) {
    const result = await d1Query("SELECT * FROM users WHERE username = ? LIMIT 1", [username]);
    return result?.results?.[0] || null;
  }
  return null;
};

const userExists = async (username) => {
  const user = await getUserByUsername(username);
  return Boolean(user);
};

const createUser = async ({ username, password }) => {
  const now = new Date().toISOString();
  const userId = crypto.randomUUID();
  const users = readUsers();
  users.push({
    id: userId,
    username,
    password,
    role: "student",
    createdAt: now,
    updatedAt: now,
  });
  writeUsers(users);

  if (fs.existsSync(profilesPath)) {
    const { rows } = parseCsv(fs.readFileSync(profilesPath, "utf-8"));
    const exists = rows.find((row) => row.username === username);
    if (!exists) {
      rows.push({
        username,
        gender: "",
        age: "",
        grade: "",
        scaleResult: "",
        modelResult: "",
        gameResult: "",
        createdAt: now,
        updatedAt: now,
      });
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
      writeCsv(header, rows, profilesPath);
    }
  }

  return { id: userId, username };
};

const readReportsIndex = async () => {
  ensureDataFiles();
  let localIndex = [];
  try {
    localIndex = JSON.parse(fs.readFileSync(reportsIndexPath, "utf-8"));
  } catch {
    localIndex = [];
  }
  if (!R2_ENABLED) return localIndex;
  const key = `${R2_REPORTS_PREFIX}/index.json`;
  try {
    const client = getR2Client();
    if (!client) return localIndex;
    const resp = await client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    const raw = await streamToString(resp.Body);
    const remoteIndex = JSON.parse(raw || "[]");
    fs.writeFileSync(reportsIndexPath, JSON.stringify(remoteIndex, null, 2), "utf-8");
    return Array.isArray(remoteIndex) ? remoteIndex : localIndex;
  } catch {
    return localIndex;
  }
};

const writeReportsIndex = async (index) => {
  fs.writeFileSync(reportsIndexPath, JSON.stringify(index, null, 2), "utf-8");
  if (!R2_ENABLED) return;
  try {
    const client = getR2Client();
    if (!client) return;
    const key = `${R2_REPORTS_PREFIX}/index.json`;
    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: JSON.stringify(index, null, 2),
        ContentType: "application/json",
        CacheControl: "no-store",
      })
    );
  } catch (error) {
    console.warn("Upload report index to R2 failed:", error.message);
  }
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

const streamToString = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
};

const streamToBuffer = async (stream) => {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const listR2Objects = async (prefix) => {
  const client = getR2Client();
  if (!client) return [];
  let continuationToken = undefined;
  const results = [];
  do {
    const resp = await client.send(
      new ListObjectsV2Command({
        Bucket: R2_BUCKET,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    const contents = resp.Contents || [];
    results.push(...contents);
    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (continuationToken);
  return results;
};

const getSignedR2Url = async (key, expiresIn = 600) => {
  const client = getR2Client();
  if (!client) return "";
  const command = new GetObjectCommand({ Bucket: R2_BUCKET, Key: key });
  return getSignedUrl(client, command, { expiresIn });
};

const buildR2PublicUrl = (key) => {
  if (!R2_PUBLIC_BASE) return "";
  const base = R2_PUBLIC_BASE.replace(/\/+$/, "");
  const cleanKey = String(key || "").replace(/^\/+/, "");
  return cleanKey ? `${base}/${cleanKey}` : base;
};

const uploadToR2 = async (key, body, contentType, contentDisposition = "") => {
  const client = getR2Client();
  if (!client) throw new Error("R2 unavailable");
  const params = {
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  };
  if (contentDisposition) params.ContentDisposition = contentDisposition;
  await client.send(new PutObjectCommand(params));
};

const getReportKey = (reportId, ext) => `${R2_REPORTS_PREFIX}/${reportId}.${ext}`;

const readReportJson = async (record) => {
  const fallbackKey = record?.id ? getReportKey(record.id, "json") : "";
  const r2JsonKey = record?.r2JsonKey || fallbackKey;
  if (r2JsonKey && R2_ENABLED) {
    try {
      const client = getR2Client();
      if (client) {
        const resp = await client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: r2JsonKey }));
        const raw = await streamToString(resp.Body);
        return JSON.parse(raw);
      }
    } catch (error) {
      console.warn("Read report JSON from R2 failed:", error.message);
    }
  }
  const reportPath = record?.jsonPath;
  if (!reportPath || !fs.existsSync(reportPath)) return null;
  return JSON.parse(fs.readFileSync(reportPath, "utf-8"));
};

const csvEscape = (value) => {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const shouldUseFileForResult = (type) => type === "scale" || type === "task";

const readResultsJsonl = () => {
  ensureDataFiles();
  if (!fs.existsSync(resultsJsonlPath)) return [];
  const raw = fs.readFileSync(resultsJsonlPath, "utf-8");
  if (!raw.trim()) return [];
  const rows = [];
  raw.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && parsed.username && parsed.type) {
        rows.push(parsed);
      }
    } catch {
      // skip malformed lines
    }
  });
  return rows;
};

const readLocalResults = () => {
  const jsonlResults = readResultsJsonl();
  const csvResults = fs.existsSync(resultsPath)
    ? parseCsv(fs.readFileSync(resultsPath, "utf-8")).rows.map((row, idx) => ({
        id: `csv-${idx + 1}`,
        username: row.username,
        type: row.type,
        data: row.data,
        createdAt: row.createdAt,
      }))
    : [];
  return [...jsonlResults, ...csvResults];
};

const getLocalResultsByType = (type) =>
  readLocalResults().filter((row) => row.type === type);

const getLocalResultById = (id, type) => {
  const rows = getLocalResultsByType(type);
  return rows.find((row) => String(row.id) === String(id)) || null;
};

const appendResultToFile = ({ id, username, type, data, createdAt }) => {
  ensureDataFiles();
  const payload = typeof data === "string" ? data : JSON.stringify(data ?? {});
  const row = JSON.stringify({
    id,
    username,
    type,
    data: payload,
    createdAt,
  });
  console.log("写入文件了吗")
  fs.appendFileSync(resultsJsonlPath, `${row}\n`, "utf-8");
};

const getD1UserIdByUsername = async (username) => {
  if (!D1_ENABLED || !username) return null;
  const result = await d1Query("SELECT id FROM users WHERE username = ? LIMIT 1", [username]);
  return result?.results?.[0]?.id || null;
};

const isNewerThan = (candidate, existing) => {
  if (!candidate) return false;
  if (!existing) return true;
  const cTime = new Date(candidate).getTime();
  const eTime = new Date(existing).getTime();
  if (Number.isNaN(cTime)) return false;
  if (Number.isNaN(eTime)) return true;
  return cTime > eTime;
};

const syncLocalResultsToD1 = async () => {
  if (!D1_ENABLED) return { total: 0, inserted: 0, skipped: 0 };
  const rows = readResultsJsonl();
  if (!rows.length) return { total: 0, inserted: 0, skipped: 0 };
  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row?.id || !row?.username || !row?.type) {
      skipped += 1;
      continue;
    }
    const payload = typeof row.data === "string" ? row.data : JSON.stringify(row.data ?? {});
    const createdAt = row.createdAt || new Date().toISOString();
    try {
      await d1Exec(
        "INSERT OR IGNORE INTO results (id, username, type, data, created_at) VALUES (?, ?, ?, ?, ?)",
        [row.id, row.username, row.type, payload, createdAt]
      );
      inserted += 1;
    } catch (error) {
      console.warn("Sync result to D1 failed:", error.message);
      skipped += 1;
    }
  }
  return { total: rows.length, inserted, skipped };
};

const syncLocalUsersToD1 = async () => {
  if (!D1_ENABLED) return { total: 0, inserted: 0, updated: 0, skipped: 0 };
  const users = readUsers();
  if (!users.length) return { total: 0, inserted: 0, updated: 0, skipped: 0 };
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  for (const user of users) {
    if (!user?.username) {
      skipped += 1;
      continue;
    }
    const now = new Date().toISOString();
    const existing = await d1Query("SELECT id, updated_at FROM users WHERE username = ? LIMIT 1", [user.username]);
    const row = existing?.results?.[0];
    const localUpdatedAt = user.updatedAt || user.createdAt || now;
    if (row?.id) {
      if (!isNewerThan(localUpdatedAt, row.updated_at)) {
        skipped += 1;
        continue;
      }
      await d1Exec(
        "UPDATE users SET password_hash = ?, status = ?, updated_at = ? WHERE id = ?",
        [user.password || user.password_hash || "", user.status || "active", localUpdatedAt, row.id]
      );
      updated += 1;
    } else {
      const id = user.id || crypto.randomUUID();
      await d1Exec(
        "INSERT INTO users (id, username, email, password_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [id, user.username, user.email || "", user.password || user.password_hash || "", user.status || "active", user.createdAt || now, localUpdatedAt]
      );
      inserted += 1;
    }
  }
  return { total: users.length, inserted, updated, skipped };
};

const syncLocalProfilesToD1 = async () => {
  if (!D1_ENABLED || !fs.existsSync(profilesPath)) {
    return { total: 0, inserted: 0, updated: 0, skipped: 0 };
  }
  const { rows } = parseCsv(fs.readFileSync(profilesPath, "utf-8"));
  if (!rows.length) return { total: 0, inserted: 0, updated: 0, skipped: 0 };
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  for (const row of rows) {
    if (!row?.username) {
      skipped += 1;
      continue;
    }
    const now = new Date().toISOString();
    const existing = await d1Query("SELECT id, updated_at FROM profiles WHERE username = ? LIMIT 1", [row.username]);
    const profileRow = existing?.results?.[0];
    const localUpdatedAt = row.updatedAt || row.createdAt || now;
    if (profileRow?.id) {
      if (!isNewerThan(localUpdatedAt, profileRow.updated_at)) {
        skipped += 1;
        continue;
      }
      await d1Exec(
        "UPDATE profiles SET gender = ?, age = ?, grade = ?, scale_result = ?, model_result = ?, game_result = ?, updated_at = ? WHERE id = ?",
        [
          row.gender || "",
          row.age || "",
          row.grade || "",
          row.scaleResult || "",
          row.modelResult || "",
          row.gameResult || "",
          localUpdatedAt,
          profileRow.id,
        ]
      );
      updated += 1;
    } else {
      const id = crypto.randomUUID();
      const userId = await getD1UserIdByUsername(row.username);
      await d1Exec(
        "INSERT INTO profiles (id, user_id, username, gender, age, grade, scale_result, model_result, game_result, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id,
          userId,
          row.username,
          row.gender || "",
          row.age || "",
          row.grade || "",
          row.scaleResult || "",
          row.modelResult || "",
          row.gameResult || "",
          row.createdAt || now,
          localUpdatedAt,
        ]
      );
      inserted += 1;
    }
  }
  return { total: rows.length, inserted, updated, skipped };
};

const syncLocalConversationsToD1 = async () => {
  if (!D1_ENABLED) return { conversations: 0, messages: 0 };
  const conversationsData = readConversations();
  const entries = Object.entries(conversationsData || {});
  let conversations = 0;
  let messagesCount = 0;
  for (const [username, convs] of entries) {
    if (!Array.isArray(convs)) continue;
    const userId = await getD1UserIdByUsername(username);
    for (const conv of convs) {
      if (!conv?.id) continue;
      const createdAt = conv.createdAt || conv.updatedAt || new Date().toISOString();
      const updatedAt = conv.updatedAt || createdAt;
      await d1Exec(
        "INSERT OR REPLACE INTO conversations (id, user_id, username, title, preview, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          conv.id,
          userId,
          username,
          conv.title || conv.preview || "",
          conv.preview || "",
          createdAt,
          updatedAt,
        ]
      );
      conversations += 1;
      const messages = Array.isArray(conv.messages) ? conv.messages : [];
      for (let i = 0; i < messages.length; i += 1) {
        const msg = messages[i] || {};
        const msgId = msg.id
          ? String(msg.id)
          : crypto
              .createHash("sha1")
              .update(`${conv.id}:${i}:${msg.createdAt || updatedAt}:${msg.text || ""}`)
              .digest("hex");
        const role = msg.sender === "ai" ? "assistant" : "user";
        const msgCreatedAt = msg.createdAt || updatedAt;
        await d1Exec(
          "INSERT OR REPLACE INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
          [msgId, conv.id, role, msg.text || "", msgCreatedAt]
        );
        messagesCount += 1;
      }
    }
  }
  return { conversations, messages: messagesCount };
};

const scheduleDailyResultsSync = () => {
  if (!D1_ENABLED) return;
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const delay = next.getTime() - now.getTime();
  setTimeout(() => {
    Promise.resolve()
      .then(syncLocalUsersToD1)
      .then(syncLocalProfilesToD1)
      .then(syncLocalResultsToD1)
      .then(syncLocalConversationsToD1)
      .then(archiveAndClearResultsFile)
      .catch((err) => {
        console.error("Daily results sync failed:", err);
      });
    setInterval(() => {
      Promise.resolve()
        .then(syncLocalUsersToD1)
        .then(syncLocalProfilesToD1)
        .then(syncLocalResultsToD1)
        .then(syncLocalConversationsToD1)
        .then(archiveAndClearResultsFile)
        .catch((err) => {
          console.error("Daily results sync failed:", err);
        });
    }, 24 * 60 * 60 * 1000);
  }, delay);
};

const archiveAndClearResultsFile = async () => {
  ensureDataFiles();
  if (!fs.existsSync(resultsJsonlPath)) return;
  const raw = fs.readFileSync(resultsJsonlPath, "utf-8");
  if (!raw.trim()) return;

  const date = new Date().toISOString().split("T")[0];
  const archiveDir = path.join(dataDir, "archive");
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }
  let target = path.join(archiveDir, `results-${date}.jsonl`);
  if (fs.existsSync(target)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    target = path.join(archiveDir, `results-${date}-${stamp}.jsonl`);
  }
  fs.renameSync(resultsJsonlPath, target);
  fs.writeFileSync(resultsJsonlPath, "", "utf-8");
};

const exportD1ToLocalFiles = async () => {
  if (!D1_ENABLED) throw new Error("D1 not configured");
  ensureDataFiles();

  const usersResult = await d1Query("SELECT * FROM users", []);
  const profilesResult = await d1Query("SELECT * FROM profiles", []);
  const resultsResult = await d1Query("SELECT id, username, type, data, created_at FROM results", []);
  const conversationsResult = await d1Query(
    "SELECT * FROM conversations ORDER BY updated_at DESC",
    []
  );

  const users = (usersResult?.results || []).map((row) => ({
    id: row.id,
    username: row.username,
    email: row.email || "",
    password: row.password_hash || "",
    status: row.status || "active",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  }));
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), "utf-8");

  const profileRows = (profilesResult?.results || []).map((row) => ({
    id: row.id,
    userId: row.user_id || "",
    username: row.username || "",
    nickname: row.nickname || "",
    avatarUrl: row.avatar_url || "",
    bio: row.bio || "",
    gender: row.gender || "",
    birthday: row.birthday || "",
    age: row.age || "",
    grade: row.grade || "",
    scaleResult: row.scale_result || "",
    modelResult: row.model_result || "",
    gameResult: row.game_result || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  }));
  fs.writeFileSync(profilesJsonPath, JSON.stringify(profileRows, null, 2), "utf-8");
  const profileHeader = [
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
  const profileCsvRows = profileRows.map((row) => ({
    username: row.username,
    gender: row.gender,
    age: row.age,
    grade: row.grade,
    scaleResult: row.scaleResult,
    modelResult: row.modelResult,
    gameResult: row.gameResult,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
  writeCsv(profileHeader, profileCsvRows, profilesPath);

  const resultsLines = (resultsResult?.results || []).map((row) =>
    JSON.stringify({
      id: row.id,
      username: row.username,
      type: row.type,
      data: row.data,
      createdAt: row.created_at,
    })
  );
  fs.writeFileSync(
    resultsJsonlPath,
    `${resultsLines.join("\n")}${resultsLines.length ? "\n" : ""}`,
    "utf-8"
  );

  const conversations = conversationsResult?.results || [];
  const conversationsPayload = {};
  for (const conv of conversations) {
    const msgResult = await d1Query(
      "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
      [conv.id]
    );
    const msgs = (msgResult?.results || []).map((m) => ({
      id: m.id,
      text: m.content,
      sender: m.role === "assistant" ? "ai" : "user",
      createdAt: m.created_at || "",
    }));
    const record = {
      id: conv.id,
      title: conv.title || "",
      preview: conv.preview || "",
      createdAt: conv.created_at || "",
      updatedAt: conv.updated_at || "",
      messages: msgs,
    };
    const username = conv.username || "unknown";
    if (!conversationsPayload[username]) conversationsPayload[username] = [];
    conversationsPayload[username].push(record);
  }
  fs.writeFileSync(conversationsPath, JSON.stringify(conversationsPayload, null, 2), "utf-8");

  return {
    users: users.length,
    profiles: profileRows.length,
    results: resultsLines.length,
    conversations: conversations.length,
  };
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

const getProfileByUsername = async (username) => {
  if (!username) return null;
  ensureDataFiles();
  const content = fs.readFileSync(profilesPath, "utf-8");
  const profiles = parseCsv(content);
  const local = profiles.rows.find((row) => row.username === username) || null;
  if (local) return local;
  if (D1_ENABLED) {
    const result = await d1Query("SELECT * FROM profiles WHERE username = ? LIMIT 1", [username]);
    return result?.results?.[0] || null;
  }
  return null;
};

const getScaleResultsByUsername = async (username) => {
  const localResults = readLocalResults();
  return localResults
    .filter((row) => row.type === "scale" && row.username === username)
    .map((row) => ({
      username: row.username,
      createdAt: row.createdAt,
      data: safeParseJson(row.data),
    }))
    .filter((r) => r.data);
};

const getTaskResultsByUsername = async (username) => {
  const localResults = readLocalResults();
  return localResults
    .filter((row) => row.type === "task" && row.username === username)
    .map((row) => ({
      username: row.username,
      createdAt: row.createdAt,
      data: safeParseJson(row.data),
    }))
    .filter((r) => r.data);
};

const upsertProfile = async ({ username, gender, age, grade }) => {
  const now = new Date().toISOString();
  if (D1_ENABLED) {
    const existing = await d1Query("SELECT id FROM profiles WHERE username = ? LIMIT 1", [username]);
    const row = existing?.results?.[0];
    if (row?.id) {
      await d1Exec(
        "UPDATE profiles SET gender = ?, age = ?, grade = ?, updated_at = ? WHERE id = ?",
        [gender ?? "", age ?? "", grade ?? "", now, row.id]
      );
    } else {
      const profileId = crypto.randomUUID();
      await d1Exec(
        "INSERT INTO profiles (id, user_id, username, gender, age, grade, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [profileId, null, username, gender ?? "", age ?? "", grade ?? "", now, now]
      );
    }
    return;
  }

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

const updateResults = async ({ username, type, data }) => {
  const now = new Date().toISOString();
  const payload = typeof data === "string" ? data : JSON.stringify(data ?? {});
  if (D1_ENABLED && !shouldUseFileForResult(type)) {
    const existing = await d1Query("SELECT id FROM profiles WHERE username = ? LIMIT 1", [username]);
    const row = existing?.results?.[0];
    const column =
      type === "scale" ? "scale_result" : type === "model" ? "model_result" : "game_result";
    if (row?.id) {
      await d1Exec(
        `UPDATE profiles SET ${column} = ?, updated_at = ? WHERE id = ?`,
        [payload, now, row.id]
      );
    } else {
      const profileId = crypto.randomUUID();
      await d1Exec(
        `INSERT INTO profiles (id, user_id, username, ${column}, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
        [profileId, null, username, payload, now, now]
      );
    }
    return;
  }

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
  if (type === "scale") found.scaleResult = payload;
  if (type === "model") found.modelResult = payload;
  if (type === "game" || type === "task") found.gameResult = payload;
  found.updatedAt = now;
  writeCsv(header, rows, profilesPath);
};

const appendResult = async ({ username, type, data }) => {
  const payload = typeof data === "string" ? data : JSON.stringify(data ?? {});
  const createdAt = new Date().toISOString();
  if (shouldUseFileForResult(type)) {
    const id = crypto.randomUUID();
    appendResultToFile({ id, username, type, data: payload, createdAt });
    return;
  }

  if (D1_ENABLED) {
    const id = crypto.randomUUID();
    await d1Exec(
      "INSERT INTO results (id, username, type, data, created_at) VALUES (?, ?, ?, ?, ?)",
      [id, username, type, payload, createdAt]
    );
    return;
  }

  ensureDataFiles();
  const row = [
    csvEscape(username),
    csvEscape(type),
    csvEscape(payload),
    csvEscape(createdAt),
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

    const exists = await userExists(username);
    if (exists) {
      return res.status(409).json({ error: "User already exists" });
    }

    await createUser({ username, password });
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

    const found = await getUserByUsername(username);
    if (!found || (found.password_hash !== password && found.password !== password)) {
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
    const allConversations = readConversations();
    const result = [];
    for (const [username, userConversations] of Object.entries(allConversations)) {
      for (const conversation of userConversations) {
        result.push({
          ...conversation,
          username
        });
      }
    }
    if (result.length > 0) {
      return res.json(result);
    }

    if (D1_ENABLED) {
      const resultDb = await d1Query(
        "SELECT * FROM conversations ORDER BY updated_at DESC",
        []
      );
      const conversations = resultDb?.results || [];
      const payload = [];
      for (const conv of conversations) {
        const msgResult = await d1Query(
          "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
          [conv.id]
        );
        const msgs = (msgResult?.results || []).map((m) => ({
          id: m.id,
          text: m.content,
          sender: m.role === "assistant" ? "ai" : "user",
        }));
        payload.push({
          id: conv.id,
          messages: msgs,
          preview: conv.preview || "",
          updatedAt: conv.updated_at,
          username: conv.username || "",
        });
      }
      return res.json(payload);
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
    const localUsers = readUsers();
    if (localUsers.length > 0) {
      const profilesContent = fs.readFileSync(profilesPath, 'utf-8');
      const profiles = parseCsv(profilesContent);
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
      const usersWithProfiles = localUsers.map(user => {
        const userRole = user.role || 'student';
        return {
          _id: user.id || user._id || user.username,
          username: user.username,
          password: user.password,
          role: userRole,
          createdAt: user.createdAt || new Date().toISOString(),
          lastLoginAt: user.lastLoginAt || null,
          profile: profileMap[user.username] || null
        };
      });
      return res.json(usersWithProfiles);
    }

    if (D1_ENABLED) {
      const usersResult = await d1Query("SELECT * FROM users", []);
      const profilesResult = await d1Query("SELECT * FROM profiles", []);
      const profileMap = {};
      for (const row of profilesResult?.results || []) {
        if (row.username) {
          profileMap[row.username] = {
            gender: row.gender || '',
            age: row.age || '',
            grade: row.grade || '',
            scaleResult: row.scale_result || '',
            modelResult: row.model_result || '',
            gameResult: row.game_result || '',
            createdAt: row.created_at || '',
            updatedAt: row.updated_at || ''
          };
        }
      }
      if (fs.existsSync(profilesPath)) {
        const localProfiles = parseCsv(fs.readFileSync(profilesPath, 'utf-8')).rows;
        for (const row of localProfiles) {
          if (!row.username) continue;
          if (!profileMap[row.username]) profileMap[row.username] = {};
          if (row.scaleResult) profileMap[row.username].scaleResult = row.scaleResult;
          if (row.gameResult) profileMap[row.username].gameResult = row.gameResult;
          if (row.modelResult) profileMap[row.username].modelResult = row.modelResult;
          if (row.updatedAt) profileMap[row.username].updatedAt = row.updatedAt;
          if (row.createdAt) profileMap[row.username].createdAt = row.createdAt;
        }
      }
      const usersWithProfiles = (usersResult?.results || []).map((user) => ({
        _id: user.id || user.username,
        username: user.username,
        password: user.password_hash,
        role: user.role || 'student',
        createdAt: user.created_at || new Date().toISOString(),
        lastLoginAt: user.last_login_at || null,
        profile: profileMap[user.username] || null
      }));
      return res.json(usersWithProfiles);
    }

    return res.json([]);
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理员获取量表结果统计 - 修改版
app.get("/api/admin/scales", async (req, res) => {
  try {
    let rows = getLocalResultsByType("scale")
      .map((row) => ({
        id: row.id,
        username: row.username,
        data: row.data,
        created_at: row.createdAt,
      }));
    if (rows.length === 0 && D1_ENABLED) {
      const result = await d1Query(
        "SELECT id, username, data, created_at FROM results WHERE type = 'scale' ORDER BY created_at DESC",
        []
      );
      rows = result?.results || [];
    }
    rows.sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt));

    const scales = rows.map((row) => {
      const parsedData = safeParseJson(row.data) || {};
      const scale = {
        _id: row.id,
        username: row.username,
        submittedAt: row.created_at,
      };
      if (parsedData.scaleId) {
        scale.scaleId = parsedData.scaleId;
        scale.scaleName = getScaleName(parsedData.scaleId);
      } else if (parsedData.scaleName) {
        scale.scaleId = parsedData.scaleName;
        scale.scaleName = parsedData.scaleName;
      } else {
        scale.scaleId = "Unknown";
        scale.scaleName = "未知量表";
      }
      if (parsedData.score && parsedData.score.total) {
        scale.totalScore = parsedData.score.total;
      } else if (parsedData.totalScore) {
        scale.totalScore = parsedData.totalScore;
      } else {
        scale.totalScore = 0;
      }
      if (parsedData.flags && parsedData.flags.riskLevel) {
        scale.riskLevel = parsedData.flags.riskLevel;
      } else if (parsedData.riskLevel) {
        scale.riskLevel = parsedData.riskLevel;
      } else {
        scale.riskLevel = "low";
      }
      scale.fullData = parsedData;
      if (parsedData.answers) scale.answers = parsedData.answers;
      if (parsedData.score) scale.scoreDetails = parsedData.score;
      if (parsedData.level) scale.level = parsedData.level;
      return scale;
    });

    return res.json(scales);
  } catch (error) {
    console.error('Get scales error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});
// 获取单个量表的详细信息
app.get("/api/admin/scale/:id", async (req, res) => {
  try {
    const scaleId = req.params.id;

    let row = getLocalResultById(scaleId, "scale");
    if (!row && D1_ENABLED) {
      const result = await d1Query(
        "SELECT id, username, data, created_at FROM results WHERE id = ? AND type = 'scale' LIMIT 1",
        [scaleId]
      );
      row = result?.results?.[0] || null;
    }
    if (row) {
      const parsedData = safeParseJson(row.data) || {};
      const scale = {
        _id: row.id,
        username: row.username,
        submittedAt: row.created_at || row.createdAt,
        fullData: parsedData,
      };
      if (parsedData.scaleId) {
        scale.scaleId = parsedData.scaleId;
        scale.scaleName = getScaleName(parsedData.scaleId);
      } else if (parsedData.scaleName) {
        scale.scaleId = parsedData.scaleName;
        scale.scaleName = parsedData.scaleName;
      }
      if (parsedData.score && parsedData.score.total) {
        scale.totalScore = parsedData.score.total;
      } else if (parsedData.totalScore) {
        scale.totalScore = parsedData.totalScore;
      }
      if (parsedData.flags && parsedData.flags.riskLevel) {
        scale.riskLevel = parsedData.flags.riskLevel;
      } else if (parsedData.riskLevel) {
        scale.riskLevel = parsedData.riskLevel;
      }
      if (parsedData.answers) scale.answers = parsedData.answers;
      if (parsedData.score) scale.scoreDetails = parsedData.score;
      if (parsedData.level) scale.level = parsedData.level;
      return res.json(scale);
    }

    const numericId = parseInt(scaleId, 10);

    const rawData = fs.readFileSync(resultsPath, 'utf-8');
    const lines = rawData.split('\n').filter(l => l.trim() !== '');

    if (numericId <= 0 || numericId >= lines.length) {
      return res.status(404).json({ error: '量表记录不存在' });
    }

    const values = parseCsvLine(lines[numericId]);

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
        _id: numericId,
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
    'DASS21': 'DASS-21 抑郁焦虑压力量表',
    'PHQ9_CHILD': 'PHQ-9 抑郁量表',
    'SRSS': '睡眠量表（SRSS）',
    'ERQ': '情绪调节（ERQ）',
    'NET_ADDICT': '网络成瘾量表（IAT）',
    'ANHEDONIA': '快感缺失量表',
    'BULLYING': '霸凌主动&被动（含网络欺凌）',
    'BULLYING_SIMPLE': '霸凌主动&被动（含网络欺凌）',
    'ACADEMIC_BURNOUT': '学业倦怠量表',
    'SCHOOL_AVERSION': '厌学量表',
    'SELF_HARM': '自伤问卷（非自杀性自伤筛查）',
    'SUICIDE': '自杀问卷（风险筛查）'
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
    "建议内容尽量简短、可执行；如有步骤，请用分条列表。",
    "如果系统资源无法匹配，也要给出通用的自我调节策略建议。",
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
  { name: "儿童冥想 · 鼻子的探索", link: "#relax-meditation" },
  { name: "睡前冥想 · 5分钟身体扫描", link: "#relax-meditation" },
  { name: "呼吸训练 · 3分钟呼吸训练", link: "#relax-meditation" },
  { name: "呼吸训练 · 做情绪的主人", link: "#relax-meditation" },
  { name: "脑波音乐 · 频段列表", link: "#relax-binaural" },
];

const normalizeChatText = (text) => String(text || "").replace(/\s+/g, "");

const classifyYesNo = (text) => {
  const t = normalizeChatText(text);
  const negPattern = /(没有|没想|没考虑|不想|从不|从来没|没有过|并没有|不会|不是)/;
  const negMatch = negPattern.test(t);
  const tPos = t.replace(new RegExp(negPattern.source, "g"), "");
  const posMatch = /(有|想过|有点|经常|偶尔|有时候|是的|对|嗯|会)/.test(tPos);
  if (posMatch) return "yes";
  if (negMatch && !posMatch) return "no";
  return "unknown";
};

const detectChatRiskUpdates = (messages) => {
  if (!Array.isArray(messages) || messages.length < 2) return [];
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  if (!lastUser || !lastAssistant) return [];

  const assistantText = normalizeChatText(lastAssistant.content);
  const userText = lastUser.content || "";
  const answer = classifyYesNo(userText);
  if (answer === "unknown") return [];

  const updates = [];
  const asksSuicide =
    /(自杀|不想活了|活着没意思|想消失|想结束)/.test(assistantText);
  const asksSelfHarm = /(伤害自己|自伤)/.test(assistantText);

  if (asksSelfHarm) {
    const ideation = answer === "yes" ? 1 : 0;
    const riskLevel = ideation ? "medium" : "low";
    updates.push({
      scaleId: "SELF_HARM",
      score: { ideation, behavior: null },
      level: {
        summary: ideation
          ? "对话追问中报告存在自伤相关想法"
          : "对话追问中未报告自伤相关想法",
      },
      flags: { riskLevel, source: "chat_followup" },
    });
  }

  if (asksSuicide) {
    const ideation = answer === "yes" ? 1 : 0;
    const riskLevel = ideation ? "medium" : "low";
    updates.push({
      scaleId: "SUICIDE",
      score: { ideation, plan: null, attempt: null, attemptCount: null },
      level: {
        summary: ideation
          ? "对话追问中报告存在自杀相关想法"
          : "对话追问中未报告自杀相关想法",
      },
      flags: { riskLevel, source: "chat_followup" },
    });
  }

  return updates;
};

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
  const profile = (await getProfileByUsername(username)) || {};
  const ageNumber = Number(String(profile.age || "").replace(/[^\d]/g, ""));
  const themeMap = getThemeScaleMap(ageNumber);
  const scaleResults = await getScaleResultsByUsername(username);
  const latestScales = getLatestScalesById(scaleResults);

  const scalesPayload = {};
  Object.keys(latestScales).forEach((scaleId) => {
    const item = latestScales[scaleId];
    const rawScore = item.data?.score || {};
    const score = { ...rawScore };
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
  const profile = (await getProfileByUsername(username)) || {};
  const scaleResults = await getScaleResultsByUsername(username);
  const taskResults = await getTaskResultsByUsername(username);
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

  const renderScale = (scaleId, options = {}) => {
    const scale = report.scales?.[scaleId];
    if (!scale) {
      if (!options.showWhenMissing) return "";
      return `
        <div class="section">
          <div class="section-title">${options.title || scaleId}</div>
          <div class="section-body">
            <div>未测评</div>
            <div class="text-block">说明：${options.missingNote || "未进行该量表测评。"}</div>
          </div>
        </div>
      `;
    }
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
    }
    if (scaleId === "SELF_HARM") {
      extraLines.push(`自伤想法频次：${score.ideation ?? "-"}`);
      extraLines.push(`自伤行为频次：${score.behavior ?? "-"}`);
      extraLines.push(`判定：任一题 ≥ 1 视为风险信号`);
      extraLines.push(`说明：${level.summary || "-"}`);
    }
    if (scaleId === "SUICIDE") {
      extraLines.push(`自杀想法：${score.ideation ?? "-"}`);
      extraLines.push(`自杀计划：${score.plan ?? "-"}`);
      extraLines.push(`自杀企图/尝试：${score.attempt ?? "-"}`);
      extraLines.push(`企图次数：${score.attemptCount ?? "-"}`);
      extraLines.push(`判定：任一题=有 视为风险信号`);
      extraLines.push(`说明：${level.summary || "-"}`);
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
    const totalLine = score.total !== undefined ? `<div>总分：${score.total ?? "-"}</div>` : "";
    const levelLine =
      level.severity ||
      level.status ||
      level.total ||
      ((scaleId === "SELF_HARM" || scaleId === "SUICIDE") ? level.summary : "-");
    return `
      <div class="section">
        <div class="section-title">${scale.scaleName || scaleId}</div>
        <div class="section-body">
          ${totalLine}
          <div>分级：${levelLine || "-"}</div>
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
      <h1>成长探索测量结果</h1>
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
      ${renderScale("SELF_HARM", {
        showWhenMissing: true,
        title: "自伤问卷（非自杀性自伤筛查）",
        missingNote: "情绪可控，未进入自伤量表测评。",
      })}
      ${renderScale("SUICIDE", {
        showWhenMissing: true,
        title: "自杀问卷（风险筛查）",
        missingNote: "情绪可控，未进入自杀量表测评。",
      })}
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

const generateReportPdfBuffer = async (report) => {
  const html = renderReportHtml(report);
  const browser = await puppeteer.launch({
    headless: "new",
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    return await page.pdf({ format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }
};

// 管理员：报告查询与生成
app.get("/api/admin/report/user/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const index = await readReportsIndex();
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
    const index = await readReportsIndex();
    const record = index.find((r) => r.id === id);
    if (!record) return res.status(404).json({ error: "Report not found" });
    const report = await readReportJson(record);
    if (!report) return res.status(404).json({ error: "Report not found" });
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

    let r2JsonKey = "";
    let r2JsonUrl = "";
    if (R2_ENABLED) {
      try {
        r2JsonKey = getReportKey(report.id, "json");
        await uploadToR2(r2JsonKey, JSON.stringify(report, null, 2), "application/json");
        r2JsonUrl = buildR2PublicUrl(r2JsonKey);
      } catch (error) {
        console.warn("Upload report JSON to R2 failed:", error.message);
      }
    }

    const index = await readReportsIndex();
    index.unshift({
      id: report.id,
      username,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      jsonPath,
      pdfPath,
      r2JsonKey,
      r2JsonUrl,
    });
    await writeReportsIndex(index);

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
    const index = await readReportsIndex();
    const record = index.find((r) => r.id === id);
    if (!record) return res.status(404).json({ error: "Report not found" });

    const report = await readReportJson(record);
    if (!report) return res.status(404).json({ error: "Report not found" });
    report.content = content || report.content;
    report.updatedAt = new Date().toISOString();
    fs.writeFileSync(record.jsonPath, JSON.stringify(report, null, 2), "utf-8");

    if (R2_ENABLED) {
      try {
        const r2JsonKey = record.r2JsonKey || getReportKey(record.id, "json");
        await uploadToR2(r2JsonKey, JSON.stringify(report, null, 2), "application/json");
        record.r2JsonKey = r2JsonKey;
        record.r2JsonUrl = buildR2PublicUrl(r2JsonKey);
      } catch (error) {
        console.warn("Upload report JSON to R2 failed:", error.message);
      }
    }

    record.updatedAt = report.updatedAt;
    await writeReportsIndex(index);

    return res.json(report);
  } catch (error) {
    console.error("Update report error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/admin/report/:id/pdf", async (req, res) => {
  try {
    const { id } = req.params;
    const index = await readReportsIndex();
    const record = index.find((r) => r.id === id);
    if (!record) return res.status(404).json({ error: "Report not found" });

    if (R2_ENABLED) {
      try {
        const r2PdfKey = record.r2PdfKey || getReportKey(record.id, "pdf");
        const client = getR2Client();
        if (client) {
          await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: r2PdfKey }));
          if (!record.r2PdfKey) {
            record.r2PdfKey = r2PdfKey;
            await writeReportsIndex(index);
          }
          const signed = await getSignedR2Url(r2PdfKey, 600);
          return res.redirect(302, signed);
        }
      } catch (error) {
        console.warn("Read report PDF from R2 failed:", error.message);
      }
    }

    const report = await readReportJson(record);
    if (!report) return res.status(404).json({ error: "Report not found" });
    const pdfBuffer = await generateReportPdfBuffer(report);
    const pdfBytes = Buffer.from(pdfBuffer);
    if (R2_ENABLED) {
      try {
        const r2PdfKey = record.r2PdfKey || getReportKey(record.id, "pdf");
        await uploadToR2(
          r2PdfKey,
          pdfBytes,
          "application/pdf",
          `attachment; filename="${record.id}.pdf"`
        );
        record.r2PdfKey = r2PdfKey;
        await writeReportsIndex(index);
        const signed = await getSignedR2Url(r2PdfKey, 600);
        return res.redirect(302, signed);
      } catch (error) {
        console.warn("Upload report PDF to R2 failed:", error.message);
      }
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${record.id}.pdf"`);
    res.setHeader("Cache-Control", "no-store");
    return res.send(pdfBytes);
  } catch (error) {
    console.error("Generate report pdf error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/api/admin/report/:id/pdf-url", async (req, res) => {
  try {
    const { id } = req.params;
    const index = await readReportsIndex();
    const record = index.find((r) => r.id === id);
    if (!record) return res.status(404).json({ error: "Report not found" });

    if (!R2_ENABLED) {
      const base = `${req.protocol}://${req.get("host")}`;
      return res.json({ url: `${base}/api/admin/report/${id}/pdf` });
    }

    const r2PdfKey = record.r2PdfKey || getReportKey(record.id, "pdf");
    const client = getR2Client();
    if (!client) return res.status(500).json({ error: "R2 unavailable" });

    try {
      await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: r2PdfKey }));
    } catch {
      const report = await readReportJson(record);
      if (!report) return res.status(404).json({ error: "Report not found" });
      const pdfBuffer = await generateReportPdfBuffer(report);
      const pdfBytes = Buffer.from(pdfBuffer);
      await uploadToR2(
        r2PdfKey,
        pdfBytes,
        "application/pdf",
        `attachment; filename="${record.id}.pdf"`
      );
      record.r2PdfKey = r2PdfKey;
      await writeReportsIndex(index);
    }

    const signed = await getSignedR2Url(r2PdfKey, 600);
    return res.json({ url: signed });
  } catch (error) {
    console.error("Generate report pdf url error:", error);
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

    await upsertProfile({ username, gender, age, grade });
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

    const found = await getProfileByUsername(username);

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
    const exists = await userExists(username);
    if (!exists) {
      return res.status(403).json({ error: "Invalid user" });
    }

    const subPath = req.params[0] || "";

    if (R2_ENABLED) {
      const prefixBase = `${R2_MEDIA_PREFIX}/${subPath}`.replace(/\/+$/, "");
      const prefix = prefixBase ? `${prefixBase}/` : `${R2_MEDIA_PREFIX}/`;
      const objects = await listR2Objects(prefix);
      const files = [];

      for (const obj of objects) {
        const key = obj.Key || "";
        if (!key || key.endsWith("/")) continue;
        if (!/\.(mp3|m4a|wav|mp4|webm|m3u8)$/i.test(key)) continue;
        if (/\.ts$/i.test(key)) continue;

        const relative = key.slice(prefix.length);
        if (!relative) continue;
        let name = path.basename(key);
        if (relative.includes("/") && key.toLowerCase().endsWith(".m3u8")) {
          const parts = relative.split("/");
          if (parts.length >= 2) name = parts[parts.length - 2];
        }
        files.push({ name, path: `r2/${key}` });
      }

      files.sort((a, b) => {
        const aMatch = a.name.match(/第(\d+)集|ep(\d+)/i);
        const bMatch = b.name.match(/第(\d+)集|ep(\d+)/i);
        const aNum = aMatch ? Number(aMatch[1] || aMatch[2]) : NaN;
        const bNum = bMatch ? Number(bMatch[1] || bMatch[2]) : NaN;
        if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
          return aNum - bNum;
        }
        return a.name.localeCompare(b.name, 'zh-CN');
      });

      return res.json({ files });
    }

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
    const exists = await userExists(username);
    if (!exists) {
      return res.status(403).json({ error: "Invalid user" });
    }

    const subPath = req.params[0] || "";
    if (R2_ENABLED && subPath.startsWith("r2/")) {
      const key = subPath.slice(3);
      if (!key) {
        return res.status(404).json({ error: "File not found" });
      }
      const filename = path.basename(key);
      const ext = path.extname(filename).toLowerCase();
      const mimeType = getMimeType(filename);

      if (ext === ".m3u8") {
        const client = getR2Client();
        if (!client) return res.status(500).json({ error: "R2 unavailable" });
        const resp = await client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
        const raw = await streamToString(resp.Body);
        const baseDir = key.includes("/") ? key.slice(0, key.lastIndexOf("/") + 1) : "";
        const lines = raw.split("\n");
        const patched = [];
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) {
            patched.push(line);
            continue;
          }
          if (/^https?:\/\//i.test(trimmed)) {
            patched.push(line);
            continue;
          }
          const clean = trimmed.split("?")[0].replace(/^\.\//, "");
          const segmentKey = `${baseDir}${clean}`;
          const signedUrl = await getSignedR2Url(segmentKey, 600);
          patched.push(signedUrl || line);
        }
        res.writeHead(200, { "Content-Type": mimeType });
        res.end(patched.join("\n"));
        return;
      }

      const signed = await getSignedR2Url(key, 600);
      if (!signed) {
        return res.status(404).json({ error: "File not found" });
      }
      res.redirect(signed);
      return;
    }

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

    await updateResults({ username, type, data });
    await appendResult({ username, type, data });
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

app.post("/api/admin/d1/export", async (req, res) => {
  try {
    const stats = await exportD1ToLocalFiles();
    return res.json({ ok: true, ...stats });
  } catch (error) {
    console.error("Export D1 to files error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/admin/d1/sync-now", async (req, res) => {
  try {
    const startedAt = Date.now();
    const users = await syncLocalUsersToD1();
    const profiles = await syncLocalProfilesToD1();
    const results = await syncLocalResultsToD1();
    const conversations = await syncLocalConversationsToD1();
    const finishedAt = Date.now();
    return res.json({
      ok: true,
      durationMs: finishedAt - startedAt,
      users,
      profiles,
      results,
      conversations,
    });
  } catch (error) {
    console.error("Sync local files to D1 error:", error);
    return res.status(500).json({ error: "Internal server error" });
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
3. 给出 1-3 条可执行建议；如果建议较长，请分条列出步骤。
4. 如适合，给出 1-2 条资源推荐，必须使用上面的链接。
5. 若无可用资源，也要给出简短的自我调节策略建议。
6. 如果内容较长，请分成“分析”与“建议”两个自然段输出。
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

    const allHistory = readConversations();
    const userHistory = allHistory[username] || [];
    if (userHistory.length > 0) {
      return res.json(userHistory);
    }

    if (D1_ENABLED) {
      const user = await getUserByUsername(username);
      const userId = user?.id || null;
      const convResult = await d1Query(
        "SELECT * FROM conversations WHERE username = ? ORDER BY updated_at DESC",
        [username]
      );
      const conversations = convResult?.results || [];
      const payload = [];
      for (const conv of conversations) {
        const msgResult = await d1Query(
          "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
          [conv.id]
        );
        const msgs = (msgResult?.results || []).map((m) => ({
          id: m.id,
          text: m.content,
          sender: m.role === "assistant" ? "ai" : "user",
        }));
        payload.push({
          id: conv.id,
          messages: msgs,
          preview: conv.preview || "",
          updatedAt: conv.updated_at,
          user_id: conv.user_id || userId,
        });
      }
      return res.json(payload);
    }

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

    const allHistory = readConversations();
    if (!allHistory[username]) allHistory[username] = [];

    const index = allHistory[username].findIndex(c => c.id === conversationId);
    const now = new Date().toISOString();
    const normalizedMessages = (messages || []).map((m) => ({
      id: m.id ? String(m.id) : crypto.randomUUID(),
      text: m.text || "",
      sender: m.sender || "user",
      createdAt: m.createdAt || now,
    }));
    const existingRecord = index > -1 ? allHistory[username][index] : null;
    const record = {
      id: conversationId,
      messages: normalizedMessages,
      preview,
      updatedAt: now,
      createdAt: existingRecord?.createdAt || now,
    };

    if (index > -1) {
      allHistory[username][index] = record;
    } else {
      allHistory[username].unshift(record);
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
initD1Tables().catch((err) => {
  console.error("Init D1 tables failed:", err);
});
scheduleDailyResultsSync();
app.get("/api/ping", (req, res) => res.json({ ok: true }));



// server.js - 修复时间格式错误
// 管理员获取概览统计数据API
app.get("/api/admin/overview/stats", async (req, res) => {
  try {
    let users = [];
    let userProfiles = [];
    let scaleResults = [];

    const localUsers = readUsers();
    if (localUsers.length > 0) {
      users = localUsers;
      userProfiles = fs.existsSync(profilesPath)
        ? parseCsv(fs.readFileSync(profilesPath, 'utf-8')).rows
        : [];
      scaleResults = readLocalResults().map((row) => ({
        type: row.type,
        createdAt: row.createdAt,
        data: row.data,
      }));
    } else if (D1_ENABLED) {
      const usersResult = await d1Query("SELECT id, username FROM users", []);
      const profilesResult = await d1Query("SELECT id, username FROM profiles", []);
      users = usersResult?.results || [];
      userProfiles = profilesResult?.results || [];
      const localResults = readLocalResults();
      scaleResults = localResults.map((row) => ({
        type: row.type,
        createdAt: row.createdAt,
        data: row.data,
      }));
      if (scaleResults.length === 0) {
        const resultsResult = await d1Query("SELECT id, type, created_at, data FROM results", []);
        scaleResults = (resultsResult?.results || []).map((row) => ({
          type: row.type,
          createdAt: row.created_at,
          data: row.data,
        }));
      }
    } else {
      users = readUsers();
      userProfiles = fs.existsSync(profilesPath)
        ? parseCsv(fs.readFileSync(profilesPath, 'utf-8')).rows
        : [];
      scaleResults = readLocalResults().map((row) => ({
        type: row.type,
        createdAt: row.createdAt,
        data: row.data,
      }));
    }

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

      if (D1_ENABLED && Object.keys(conversationsData || {}).length === 0) {
        const convResult = await d1Query("SELECT id, username, updated_at FROM conversations", []);
        const conversations = convResult?.results || [];
        for (const conv of conversations) {
          const msgResult = await d1Query(
            "SELECT id, created_at FROM messages WHERE conversation_id = ?",
            [conv.id]
          );
          const msgs = msgResult?.results || [];
          const messageCount = msgs.length;
          conversationStats.totalMessages += messageCount;
          conversationStats.totalConversations += 1;
          if (conv.username) userSet.add(conv.username);
          const convoDate = conv.updated_at ? new Date(conv.updated_at).toISOString().split('T')[0] : null;
          if (convoDate === today) {
            conversationStats.todayMessages += messageCount;
            conversationStats.todayConversations += 1;
            if (conv.username) todayUserSet.add(conv.username);
          }
        }
      } else {
        for (const [username, userConversations] of Object.entries(conversationsData || {})) {
          if (Array.isArray(userConversations)) {
            userSet.add(username);
            for (const conversation of userConversations) {
              if (conversation && conversation.messages) {
                const messageCount = conversation.messages.length || 0;
                conversationStats.totalMessages += messageCount;
                conversationStats.totalConversations += 1;
                let isToday = false;
                if (conversation.updatedAt) {
                  const convoDate = new Date(conversation.updatedAt).toISOString().split('T')[0];
                  isToday = convoDate === today;
                } else if (conversation.messages && conversation.messages.length > 0) {
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
    let rows = getLocalResultsByType("task")
      .map((row) => ({
        id: row.id,
        username: row.username,
        data: row.data,
        created_at: row.createdAt,
      }));
    if (rows.length === 0 && D1_ENABLED) {
      const result = await d1Query(
        "SELECT id, username, data, created_at FROM results WHERE type = 'task' ORDER BY created_at DESC",
        []
      );
      rows = result?.results || [];
    }
    rows.sort((a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt));

    const tasks = rows.map((row) => {
      const parsedData = safeParseJson(row.data) || {};
      const task = {
        _id: row.id,
        username: row.username,
        submittedAt: row.created_at,
        taskData: parsedData,
      };
      if (parsedData.taskId) {
        task.taskId = parsedData.taskId;
        task.taskName = getTaskName(parsedData.taskId);
      } else {
        task.taskId = "Unknown";
        task.taskName = "未知游戏";
      }
      if (parsedData.summary) {
        task.summary = parsedData.summary;
        task.accuracy = parsedData.summary.accuracy || 0;
        task.meanRT = parsedData.summary.meanRT || 0;
        task.performanceScore = calculatePerformanceScore(parsedData.summary);
      }
      task.fullData = parsedData;
      return task;
    });

    return res.json(tasks);
  } catch (error) {
    console.error('Get tasks error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// 获取单个游戏的详细信息
app.get("/api/admin/task/:id", async (req, res) => {
  try {
    const taskId = req.params.id;

    let row = getLocalResultById(taskId, "task");
    if (!row && D1_ENABLED) {
      const result = await d1Query(
        "SELECT id, username, data, created_at FROM results WHERE id = ? AND type = 'task' LIMIT 1",
        [taskId]
      );
      row = result?.results?.[0] || null;
    }
    if (row) {
      const parsedData = safeParseJson(row.data) || {};
      const task = {
        _id: row.id,
        username: row.username,
        submittedAt: row.created_at || row.createdAt,
        fullData: parsedData,
      };
      if (parsedData.taskId) {
        task.taskId = parsedData.taskId;
        task.taskName = getTaskName(parsedData.taskId);
      }
      if (parsedData.summary) {
        task.summary = parsedData.summary;
        task.performanceScore = calculatePerformanceScore(parsedData.summary);
      }
      if (parsedData.config) {
        task.config = parsedData.config;
      }
      if (parsedData.trials) {
        task.trials = parsedData.trials;
      }
      return res.json(task);
    }

    const numericId = parseInt(taskId, 10);

    const rawData = fs.readFileSync(resultsPath, 'utf-8');
    const lines = rawData.split('\n').filter(l => l.trim() !== '');

    if (numericId <= 0 || numericId >= lines.length) {
      return res.status(404).json({ error: '游戏记录不存在' });
    }

    const values = parseCsvLine(lines[numericId]);

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
        _id: numericId,
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
