const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const D1_ACCOUNT_ID = process.env.D1_ACCOUNT_ID || "";
const D1_DATABASE_ID = process.env.D1_DATABASE_ID || "";
const D1_API_TOKEN = process.env.D1_API_TOKEN || "";
const D1_API_BASE = `https://api.cloudflare.com/client/v4/accounts/${D1_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}`;

if (!D1_ACCOUNT_ID || !D1_DATABASE_ID || !D1_API_TOKEN) {
  console.error("Missing D1 env vars.");
  process.exit(1);
}

const d1Query = async (sql, params = []) => {
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

const parseCsvLine = (line) => {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result;
};

const loadCsv = (filePath) => {
  if (!fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, "utf-8");
  const lines = raw.split("\n").filter((l) => l.trim() !== "");
  if (lines.length <= 1) return [];
  return lines.slice(1).map(parseCsvLine);
};

const run = async () => {
  const dataDir = path.join(__dirname, "..", "usr");
  const usersPath = path.join(dataDir, "users.json");
  const profilesPath = path.join(dataDir, "profiles.csv");
  const resultsPath = path.join(dataDir, "results.csv");
  const conversationsPath = path.join(dataDir, "conversations.json");

  const users = fs.existsSync(usersPath) ? JSON.parse(fs.readFileSync(usersPath, "utf-8")) : [];
  for (const user of users) {
    if (!user?.username) continue;
    const existing = await d1Query("SELECT id FROM users WHERE username = ? LIMIT 1", [user.username]);
    if (existing?.results?.length) continue;
    const id = crypto.randomUUID();
    const now = user.createdAt || new Date().toISOString();
    await d1Exec(
      "INSERT INTO users (id, username, email, password_hash, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, user.username, user.email || "", user.password || "", "active", now, now]
    );
  }

  const profileRows = loadCsv(profilesPath);
  for (const row of profileRows) {
    const [username, gender, age, grade, scaleResult, modelResult, gameResult, createdAt, updatedAt] = row;
    if (!username) continue;
    const existing = await d1Query("SELECT id FROM profiles WHERE username = ? LIMIT 1", [username]);
    if (existing?.results?.length) continue;
    const id = crypto.randomUUID();
    await d1Exec(
      "INSERT INTO profiles (id, user_id, username, gender, age, grade, scale_result, model_result, game_result, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        null,
        username,
        gender || "",
        age || "",
        grade || "",
        scaleResult || "",
        modelResult || "",
        gameResult || "",
        createdAt || new Date().toISOString(),
        updatedAt || new Date().toISOString(),
      ]
    );
  }

  const resultRows = loadCsv(resultsPath);
  for (const row of resultRows) {
    const [username, type, data, createdAt] = row;
    if (!username || !type || !data) continue;
    const id = crypto.randomUUID();
    await d1Exec(
      "INSERT INTO results (id, username, type, data, created_at) VALUES (?, ?, ?, ?, ?)",
      [id, username, type, data, createdAt || new Date().toISOString()]
    );
  }

  if (fs.existsSync(conversationsPath)) {
    const conversations = JSON.parse(fs.readFileSync(conversationsPath, "utf-8"));
    for (const [username, convs] of Object.entries(conversations)) {
      if (!Array.isArray(convs)) continue;
      for (const conv of convs) {
        const convId = String(conv.id || crypto.randomUUID());
        const existing = await d1Query("SELECT id FROM conversations WHERE id = ? LIMIT 1", [convId]);
        if (!existing?.results?.length) {
          await d1Exec(
            "INSERT INTO conversations (id, user_id, username, title, preview, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
              convId,
              null,
              username,
              conv.preview || "",
              conv.preview || "",
              conv.updatedAt || new Date().toISOString(),
              conv.updatedAt || new Date().toISOString(),
            ]
          );
        }
        const msgs = Array.isArray(conv.messages) ? conv.messages : [];
        for (const msg of msgs) {
          const msgId = msg.id ? String(msg.id) : crypto.randomUUID();
          const role = msg.sender === "ai" ? "assistant" : "user";
          await d1Exec(
            "INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)",
            [msgId, convId, role, msg.text || "", conv.updatedAt || new Date().toISOString()]
          );
        }
      }
    }
  }

  console.log("D1 migration done.");
};

run().catch((err) => {
  console.error("D1 migration failed:", err);
  process.exit(1);
});
