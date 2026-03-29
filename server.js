require("dotenv").config();
const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ADMIN_KEY = String(process.env.ADMIN_KEY || "trendsetter_admin_2026").trim();
const ADMIN_CHAT_ID = String(process.env.ADMIN_CHAT_ID || "").replace(/\s+/g, "").trim();
const ADMIN_IDS_ENV = String(process.env.ADMIN_IDS || "").trim();
const DATA_DIR = path.join(__dirname, "data");
const DB_FILE = path.join(DATA_DIR, "store.json");

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function normalizeId(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function envAdmins() {
  const ids = ADMIN_IDS_ENV.split(",").map(v => normalizeId(v)).filter(Boolean);
  if (ADMIN_CHAT_ID && !ids.includes(ADMIN_CHAT_ID)) ids.unshift(ADMIN_CHAT_ID);
  return [...new Set(ids)];
}

function defaultStore() {
  return {
    products: [],
    orders: [],
    admins: []
  };
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function writeStore(data) {
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

function readStore() {
  ensureDataDir();
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  } catch {
    const data = defaultStore();
    writeStore(data);
    return data;
  }
}

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("SERVER STARTED ON " + PORT);
});
