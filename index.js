// index.js (ESM) — BMEDIA MD (Baileys v7)
// ✅ Pairing-code login (DO NOT CHANGE pairing logic structure)
// ✅ Stable reconnect (cleans old listeners)
// ✅ Lazy command loading via ./commands/manifest.json (imports only when command is used)
// ✅ Processes ALL messages in upsert array
// ✅ Command timeout guard + temp cleanup on timeout
// ✅ Public/Private mode gate (owner can switch; private allows group admins + sudo + owner)
// ✅ Uses JID for owner/sudo/ban identity (no LID)

import fs from "fs";
import path from "path";
import readline from "readline";
import http from "http";
import { fileURLToPath, pathToFileURL } from "url";
import dotenv from "dotenv";
import P from "pino";
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
} from "@whiskeysockets/baileys";
// Centralized owner check + robust sender JID extraction
import { isOwner, getSenderJidFromMessage, normalizeJid } from "./checks/isOwner.js";
import { isSudoByJid } from "./checks/isSudo.js";
import { parseIdList, numberToUserJid } from "./utils/jid.js";
import { handleModeCommand } from "./control/mode.js";
import { handleAntiLink } from "./control/antiLinkHandler.js";
import { handleAutoReact } from "./control/autoReactHandler.js";
import { handleAntiBadword } from "./control/antiBadwordHandler.js";
import { handleAutoRead } from "./control/autoReadHandler.js";
import { handleAutoTyping } from "./control/autoTypingHandler.js";
import { handleAtasaAutoReply } from "./control/atasaHandler.js";
import { handleAntiPorn } from "./control/antiPornHandler.js";
import { handleAntiSpam } from "./control/antiSpamHandler.js";
import { handleAntiFlood } from "./control/antiFloodHandler.js";
import { handleAntiMentionAll } from "./control/antiMentionAllHandler.js";
import { handleAntiFake } from "./control/antiFakeHandler.js";
import { handleAntiBot } from "./control/antiBotHandler.js";
import { handleJoinApproval } from "./control/joinApprovalHandler.js";
import {

  cacheAntiDeleteMessage,

  handleAntiDeleteUpdates,

  handleAntiDeleteDeleteEvent

} from "./control/antiDeleteHandler.js";

import handleStatusView from "./control/statusViewHandler.js";
import { handleLinuxShell } from "./control/linuxHandler.js";
import { handleAntiGroupMention } from "./control/antiGroupMentionHandler.js";
import { handleGMComment } from "./control/gmCommentHandler.js";
import {

  hasMongoSessionConfig,
  restoreAuthFromSessionId,
  authDirHasFiles,
  claimSessionForRuntime,
  syncAuthToSession,
  restoreRuntimeStateFromSession,
  syncRuntimeStateToSession,
} from "./sessionMongo.js";
import { handleStartupGroupJoin } from "./control/startupGroupJoinHandler.js";
import { handlePOChatbotReply } from "./control/poChatbotHandler.js";
import { registerGroupGreetingsHandler } from "./handlers/groupGreetingsHandler.js";
import { startDailyBibleScheduler } from "./control/dailyBibleHandler.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Load .env reliably (same folder as index.js)
dotenv.config({ path: path.join(__dirname, ".env") });

// ----------------------------- ENV -----------------------------
const BOT_NAME = String(process.env.BOT_NAME || "BMEDIA MD").trim();
const DEFAULT_PREFIX = "!";
const ENV_PREFIX = String(process.env.PREFIX || "").trim();
const AUTHOR = String(process.env.AUTHOR || "BMEDIA").trim();
const BOT_MODE_LABEL = String(process.env.BOT_MODE || "Public").trim();

const PHONE_NUMBER = String(process.env.PHONE_NUMBER || "").trim(); // pairing + owner notify
const OWNER_NUMBER = String(process.env.OWNER_NUMBER || PHONE_NUMBER || "").trim();
const REPO_URL = String(process.env.REPO_URL || "").trim();
const SESSION_ID = String(process.env.SESSION_ID || "").trim();

const MONGODB_URI = String(process.env.MONGODB_URI || "").trim();

const SESSION_DB_NAME = String(process.env.SESSION_DB_NAME || "bmedia_sessions").trim();

const SESSION_COLLECTION = String(process.env.SESSION_COLLECTION || "sessions").trim();

const SESSION_SYNC_DEBOUNCE_MS = Number(process.env.SESSION_SYNC_DEBOUNCE_MS || 12000);

const ALLOW_SELF = String(process.env.ALLOW_SELF || "0").trim() === "1";
const AUTO_RELOAD_COMMANDS = String(process.env.AUTO_RELOAD_COMMANDS || "0").trim() === "1";
const COMMAND_TIMEOUT_MS = Number(process.env.COMMAND_TIMEOUT_MS || 15000);

const TIMEZONE = String(process.env.TIMEZONE || "Africa/Douala").trim();
const PORT = Number(process.env.PORT || 3000);

const AUTH_DIR = path.join(__dirname, "auth_info_bmedia");
const COMMANDS_DIR = path.join(__dirname, "commands");
const MANIFEST_FILE = path.join(COMMANDS_DIR, "manifest.json");

// Presence keepalive
const KEEPALIVE_MS = 50_000;

// ----------------------------- CONTROL (MODE/SUDO/BAN) -----------------------------
// You asked for a control folder that persists state.
const CONTROL_DIR = path.join(__dirname, "control");
const CONTROL_STATE_FILE = path.join(CONTROL_DIR, "state.json");
const CONTROL_BANNED_FILE = path.join(CONTROL_DIR, "banned.json");
const CONTROL_CONFIG_FILE = path.join(CONTROL_DIR, "config.json");

// .env inputs (NUMBERS) — comma/space/newline separated
// Example:
// OWNER_NUMBER=+2376xxxxxxx
// SUDO_NUMBERS=+2376...,+2376...
const ENV_SUDO_NUMBERS = String(process.env.SUDO_NUMBERS || "").trim();

// ----------------------------- STATE -----------------------------
let sock = null;
let pairingRequested = false;
let ownerNumberCache = "";
let keepAliveTimer = null;
let autoReloadTimer = null;
let authSyncTimer = null;
let runtimeSyncTimer = null;
let runtimeStateRestored = false;
let whatsappConnected = false;
// Never push restored auth back to MongoDB until WhatsApp has accepted it at least once.
// This prevents a failed startup/pairing fallback from corrupting a good SESSION_ID snapshot.
let authPersistenceArmed = false;
let healthServer = null;

// Loaded commands cache (name/alias -> command module object)
const commandCache = new Map();
// Manifest map (name -> {file, aliases[]})
let manifest = {};

// control cache (tiny TTL to avoid constant disk reads)
let controlCache = { ts: 0, state: null };
let prefixCache = { ts: 0, prefix: null };
const CONTROL_CACHE_MS = 2000;

// group meta cache (avoid hitting metadata every message)
const groupMetaCache = new Map(); // jid -> { ts, meta }
const GROUP_META_TTL_MS = 20_000;

// ----------------------------- LOGGING -----------------------------
function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

process.on("unhandledRejection", (err) => log("UNHANDLED REJECTION:", err?.message || err));
process.on("uncaughtException", (err) => log("UNCAUGHT EXCEPTION:", err?.message || err));

// ----------------------------- CLOUD / PERSISTENCE -----------------------------
function mongoSessionReady() {
  return !!SESSION_ID && hasMongoSessionConfig({
    mongoUri: MONGODB_URI,
    dbName: SESSION_DB_NAME,
    collectionName: SESSION_COLLECTION,
  });
}

function scheduleAuthSync(delay = SESSION_SYNC_DEBOUNCE_MS) {
  if (!mongoSessionReady() || !authPersistenceArmed) return;
  if (authSyncTimer) clearTimeout(authSyncTimer);
  authSyncTimer = setTimeout(async () => {
    authSyncTimer = null;
    try {
      await syncAuthToSession({
        sessionId: SESSION_ID,
        mongoUri: MONGODB_URI,
        dbName: SESSION_DB_NAME,
        collectionName: SESSION_COLLECTION,
        authDir: AUTH_DIR,
      });
    } catch (e) {
      log("⚠️ Mongo auth sync failed:", e?.message || e);
    }
  }, Math.max(250, Number(delay) || 1500));
  try { authSyncTimer.unref?.(); } catch {}
}

function scheduleRuntimeStateSync(delay = 2500) {
  if (!mongoSessionReady()) return;
  if (runtimeSyncTimer) clearTimeout(runtimeSyncTimer);
  runtimeSyncTimer = setTimeout(async () => {
    runtimeSyncTimer = null;
    try {
      await syncRuntimeStateToSession({
        sessionId: SESSION_ID,
        mongoUri: MONGODB_URI,
        dbName: SESSION_DB_NAME,
        collectionName: SESSION_COLLECTION,
        projectRoot: __dirname,
      });
    } catch (e) {
      log("⚠️ Mongo runtime-state sync failed:", e?.message || e);
    }
  }, Math.max(500, Number(delay) || 2500));
  try { runtimeSyncTimer.unref?.(); } catch {}
}

function startPersistenceHeartbeat() {
  const timer = setInterval(() => {
    scheduleAuthSync(500);
    scheduleRuntimeStateSync(1000);
  }, 60_000);
  try { timer.unref?.(); } catch {}
}

function startHealthServer() {
  if (healthServer) return;
  healthServer = http.createServer((req, res) => {
    const url = String(req.url || "/").split("?")[0];
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");

    if (url === "/health" || url === "/") {
      res.statusCode = 200;
      res.end(JSON.stringify({
        status: "ok",
        service: BOT_NAME,
        whatsappConnected,
        uptimeSeconds: Math.floor(process.uptime()),
      }));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ status: "not_found" }));
  });

  healthServer.listen(PORT, "0.0.0.0", () => {
    log(`🌐 Health server listening on 0.0.0.0:${PORT}`);
  });
}

async function flushPersistentState() {
  if (!mongoSessionReady()) return;
  try {
    await syncAuthToSession({
      sessionId: SESSION_ID,
      mongoUri: MONGODB_URI,
      dbName: SESSION_DB_NAME,
      collectionName: SESSION_COLLECTION,
      authDir: AUTH_DIR,
      force: true,
    });
  } catch (e) {
    log("⚠️ Final auth sync failed:", e?.message || e);
  }

  try {
    await syncRuntimeStateToSession({
      sessionId: SESSION_ID,
      mongoUri: MONGODB_URI,
      dbName: SESSION_DB_NAME,
      collectionName: SESSION_COLLECTION,
      projectRoot: __dirname,
      force: true,
    });
  } catch (e) {
    log("⚠️ Final runtime-state sync failed:", e?.message || e);
  }
}

let shuttingDown = false;
async function gracefulShutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`🛑 ${signal} received; saving persistent state...`);
  try { await flushPersistentState(); } catch {}
  try { await cleanupSocket(); } catch {}
  try { healthServer?.close?.(); } catch {}
  process.exit(0);
}

process.once("SIGTERM", () => { gracefulShutdown("SIGTERM"); });
process.once("SIGINT", () => { gracefulShutdown("SIGINT"); });

// ----------------------------- HELPERS -----------------------------

//CORRECT TIME FOR THE CONNECTED MESSAGE

function formatNowInTZ(tz) {

  try {

    const parts = new Intl.DateTimeFormat("en-GB", {

      timeZone: tz,

      year: "numeric",

      month: "2-digit",

      day: "2-digit",

      hour: "2-digit",

      minute: "2-digit",

      second: "2-digit",

      hour12: false,

    }).formatToParts(new Date());

    const get = (t) => parts.find((p) => p.type === t)?.value || "";

    const time = `${get("hour")}:${get("minute")}:${get("second")}`;

    const date = `${get("day")}/${get("month")}/${get("year")}`;

    return `${time}, ${date}`;

  } catch {

    // fallback (server timezone)

    const d = new Date();

    const pad = (n) => String(n).padStart(2, "0");

    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

  }

}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function sanitizePhone(s) { return String(s || "").replace(/[^\d]/g, ""); }
function ownerJid() {
  const d = sanitizePhone(OWNER_NUMBER);
  return d ? `${d}@s.whatsapp.net` : "";
}

function isGroupJid(jid) {
  return typeof jid === "string" && jid.endsWith("@g.us");
}

function getText(m) {
  const msg = m?.message || {};
  if (msg.conversation) return msg.conversation;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
  if (msg.imageMessage?.caption) return msg.imageMessage.caption;
  if (msg.videoMessage?.caption) return msg.videoMessage.caption;
  if (msg.documentMessage?.caption) return msg.documentMessage.caption;
  return "";
}

function loadPrefixCached(force = false) {
  const now = Date.now();
  if (!force && prefixCache?.ts && (now - prefixCache.ts < CONTROL_CACHE_MS)) {
    return prefixCache.prefix;
  }
  ensureControlFiles();
  const cfg = readJsonSafe(CONTROL_CONFIG_FILE, { prefix: null, updatedAt: now });

  // cfg.prefix can be:
  // - null/undefined => use ENV_PREFIX default
  // - ""            => no-prefix mode
  // - "!" / "." etc => custom prefix
  let p = cfg?.prefix;
  if (p === null || typeof p === "undefined") {
    // Priority: config.json -> .env -> "!"
    const envP = String(ENV_PREFIX || "").trim();
    p = envP ? envP : DEFAULT_PREFIX;
  } else {
    p = String(p);
  }

  prefixCache = { ts: now, prefix: p };
  return p;
}

function getActivePrefix() {
  return loadPrefixCached(false);
}

function parseCommand(text, activePrefix) {
  const raw = String(text || "");
  const fallback = (String(ENV_PREFIX || "").trim() || DEFAULT_PREFIX);
  const pfx = typeof activePrefix === "string" ? activePrefix : fallback;
  const t = raw.trim();
  if (!t) return null;

  // No-prefix mode:
  // To avoid treating normal conversation as commands, only accept if first token matches a command in manifest.
  if (pfx === "") {
    const [cmdRaw, ...args] = t.split(/\s+/);
    const cmd = String(cmdRaw || "").toLowerCase();
    if (!cmd) return null;

    const direct = manifest && Object.prototype.hasOwnProperty.call(manifest, cmd);
    let aliasHit = false;
    if (!direct && manifest) {
      for (const info of Object.values(manifest)) {
        const aliases = Array.isArray(info?.aliases) ? info.aliases : [];
        if (aliases.map((a) => String(a).toLowerCase()).includes(cmd)) { aliasHit = true; break; }
      }
    }
    if (!direct && !aliasHit) return null;

    return { cmd, args };
  }

  if (!t.startsWith(pfx)) return null;
  const body = t.slice(pfx.length).trim();
  if (!body) return null;
  const [cmdRaw, ...args] = body.split(/\s+/);
  return { cmd: String(cmdRaw || "").toLowerCase(), args };
}


function withTimeout(promise, ms, label = "command") {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`${label} timeout after ${ms}ms`)), ms)),
  ]);
}

function shouldIgnoreMessage(m) {
  if (!m?.key) return true;
  if (m.key.remoteJid === "status@broadcast") return true;

  // You requested not ignoring self messages.
  return false;
}

async function safeSend(to, content, opts = {}) {
  try { return await sock.sendMessage(to, content, opts); }
  catch { return null; }
}


// ----------------------------- TEMP CLEANUP (ON TIMEOUT) -----------------------------
function tempDirPath() {
  return path.join(process.cwd(), "temp");
}

function downloadTempDirPath() {
  return path.join(process.cwd(), "download_temp");
}

function clearDir(dir) {
  try {
    if (!fs.existsSync(dir)) return 0;

    let removed = 0;
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      try {
        const st = fs.statSync(p);
        if (st.isFile()) {
          fs.unlinkSync(p);
          removed++;
        } else {
          fs.rmSync(p, { recursive: true, force: true });
          removed++;
        }
      } catch {}
    }
    return removed;
  } catch {
    return 0;
  }
}

function clearTempFolder() {
  const tempRemoved = clearDir(tempDirPath());
  const downloadTempRemoved = clearDir(downloadTempDirPath());

  return {
    tempRemoved,
    downloadTempRemoved,
    totalRemoved: tempRemoved + downloadTempRemoved,
  };
}

// ----------------------------- CONTROL STATE -----------------------------
function ensureControlFiles() {
  try {
    if (!fs.existsSync(CONTROL_DIR)) fs.mkdirSync(CONTROL_DIR, { recursive: true });

    // Default state from env
    if (!fs.existsSync(CONTROL_STATE_FILE)) {
      const owners = [normalizeJid(numberToUserJid(OWNER_NUMBER))].filter(Boolean);
      const sudos = parseIdList(ENV_SUDO_NUMBERS);

      // Owners come from OWNER_NUMBER env; state owners is just cached metadata.
      const initial = {
        mode: "public",     // "public" | "private"
        owners,             // JIDs
        sudos,              // JIDs (optional; sudo.json is the main source)
        updatedAt: Date.now()
      };
      fs.writeFileSync(CONTROL_STATE_FILE, JSON.stringify(initial, null, 2));
    }

    if (!fs.existsSync(CONTROL_BANNED_FILE)) {
      fs.writeFileSync(CONTROL_BANNED_FILE, JSON.stringify({ banned: [], updatedAt: Date.now() }, null, 2));
    }

    if (!fs.existsSync(CONTROL_CONFIG_FILE)) {
      fs.writeFileSync(CONTROL_CONFIG_FILE, JSON.stringify({ prefix: null, updatedAt: Date.now() }, null, 2));
    }
  } catch (e) {
    log("Control init failed:", e?.message || e);
  }
}

function readJsonSafe(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf-8") || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function loadControlStateCached(force = false) {
  const now = Date.now();
  if (!force && controlCache?.state && (now - controlCache.ts < CONTROL_CACHE_MS)) {
    return controlCache.state;
  }

  ensureControlFiles();

  const state = readJsonSafe(CONTROL_STATE_FILE, { mode: "public", owners: [], sudos: [], updatedAt: now });
  const bannedObj = readJsonSafe(CONTROL_BANNED_FILE, { banned: [], updatedAt: now });

  // Migrate legacy lid arrays in state.json/banned.json to JIDs if needed
  const ownersMerged = [...new Set([
    ...(state?.owners || []),
    normalizeJid(numberToUserJid(OWNER_NUMBER)),
  ].map(normalizeJid).filter(Boolean))];

  const sudosMerged = [...new Set([
    ...(state?.sudos || []),
    ...parseIdList(ENV_SUDO_NUMBERS)
  ].map(normalizeJid).filter(Boolean))];

  const bannedMerged = [...new Set((bannedObj?.banned || []).map(normalizeJid).filter(Boolean))];

  const normalized = {
    mode: String(state?.mode || "public").toLowerCase() === "private" ? "private" : "public",
    owners: ownersMerged,
    sudos: sudosMerged,
    banned: bannedMerged,
    updatedAt: Number(state?.updatedAt || now)
  };

  controlCache = { ts: now, state: normalized };
  return normalized;
}

function saveControlState(partial) {
  ensureControlFiles();
  const current = loadControlStateCached(true);
  const next = {
    mode: partial?.mode ? String(partial.mode).toLowerCase() : current.mode,
    owners: Array.isArray(partial?.owners) ? partial.owners : current.owners,
    sudos: Array.isArray(partial?.sudos) ? partial.sudos : current.sudos,
    updatedAt: Date.now(),
  };
  fs.writeFileSync(CONTROL_STATE_FILE, JSON.stringify(next, null, 2));
  // keep banned file separate
  controlCache.ts = 0;
}

// Banned check uses normalized user JID

function isBannedByJid(jid) {
  const ctrl = loadControlStateCached();
  const me = normalizeJid(jid);
  return !!me && ctrl.banned.includes(me);
}

// group admin check uses JID (as you requested: "jid to verify admin")
async function isSenderGroupAdmin(groupJid, senderJid) {
  if (!isGroupJid(groupJid)) return false;
  const sj = normalizeJid(senderJid);
  if (!sj) return false;

  const now = Date.now();
  const cached = groupMetaCache.get(groupJid);
  let meta = cached?.meta;
  if (!meta || (now - cached.ts > GROUP_META_TTL_MS)) {
    try {
      meta = await sock.groupMetadata(groupJid);
      groupMetaCache.set(groupJid, { ts: now, meta });
    } catch {
      return false;
    }
  }

  const p = meta?.participants?.find((x) => normalizeJid(x?.id) === sj);
  return p?.admin === "admin" || p?.admin === "superadmin";
}

// Enforce mode gate BEFORE running any command
async function canUseBot({ from, senderJid }) {
  const ctrl = loadControlStateCached();

  // Banned always blocked
  if (isBannedByJid(senderJid)) {
    return { ok: false, reason: "❌ You are banned from using this bot." };
  }

  // Public mode: everyone allowed
  if (ctrl.mode === "public") {
    return { ok: true };
  }

  // Private mode:
  // - owner/sudo always allowed
  if (isOwner({ senderJid }) || isSudoByJid(senderJid)) {
    return { ok: true };
  }

  // else blocked
  return { ok: false, reason: "🔒 Private mode: only Owner and sudo can use this bot." };
}

// Mode switch handled in ./control/mode.js

// ----------------------------- COMMAND MANIFEST + LAZY IMPORT -----------------------------
function loadManifestFromDisk() {
  try {
    if (fs.existsSync(MANIFEST_FILE)) {
      const data = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf-8") || "{}");
      manifest = data && typeof data === "object" ? data : {};
      return;
    }
  } catch (e) {
    log("Manifest read failed:", e?.message || e);
  }
  manifest = {};
}

function rebuildManifestFallback() {
  try {
    const files = fs.readdirSync(COMMANDS_DIR).filter((f) => f.endsWith(".js"));
    const out = {};
    for (const f of files) {
      const n = path.basename(f, ".js").toLowerCase();
      out[n] = { file: f, aliases: [] };
    }
    manifest = out;
  } catch {
    manifest = {};
  }
}

function ensureManifestLoaded() {
  loadManifestFromDisk();
  if (!manifest || Object.keys(manifest).length === 0) rebuildManifestFallback();
}

async function preloadAllCommandsForMenu() {
  try {
    const names = Object.keys(manifest || {});
    for (const name of names) await importCommand(name);
    log(`✅ Commands preloaded: ${commandCache.size}`);
  } catch (e) {
    log("Preload commands failed:", e?.message || e);
  }
}

async function importCommand(cmdName) {
  const key = String(cmdName || "").toLowerCase();
  if (!key) return null;
  if (commandCache.has(key)) return commandCache.get(key);

  let entry = manifest[key];
  if (!entry) {
    for (const [name, info] of Object.entries(manifest)) {
      const aliases = Array.isArray(info?.aliases) ? info.aliases : [];
      if (aliases.map((a) => String(a).toLowerCase()).includes(key)) { entry = info; break; }
    }
  }

  const fileName = entry?.file || `${key}.js`;
  const full = path.join(COMMANDS_DIR, fileName);
  if (!fs.existsSync(full)) return null;

  const bust = fs.statSync(full).mtimeMs;
  const url = pathToFileURL(full).href + `?v=${bust}`;
  const mod = await import(url);
  const cmd = mod?.default;

  if (!cmd?.name || typeof cmd.execute !== "function") return null;

  commandCache.set(String(cmd.name).toLowerCase(), cmd);
  if (Array.isArray(cmd.aliases)) for (const a of cmd.aliases) commandCache.set(String(a).toLowerCase(), cmd);
  commandCache.set(key, cmd);
  return cmd;
}

function ensureAutoReload() {
  if (!AUTO_RELOAD_COMMANDS) return;
  if (autoReloadTimer) return;

  autoReloadTimer = setInterval(() => {
    try { ensureManifestLoaded(); log("🔁 Manifest refreshed"); } catch {}
  }, 30_000);

  try { autoReloadTimer.unref?.(); } catch {}
}

// ----------------------------- SOCKET CLEANUP -----------------------------
async function cleanupSocket() {
  whatsappConnected = false;
  try {
    if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
    if (sock?.ev?.removeAllListeners) sock.ev.removeAllListeners();
    if (sock?.end) sock.end();
  } catch {}
  sock = null;
}

// ----------------------------- PRESENCE KEEPALIVE + CONNECT NOTIFY -----------------------------
function startKeepAlive() {
  if (keepAliveTimer) return;
  keepAliveTimer = setInterval(async () => {
    try {
      const jid = ownerJid();
      if (jid && sock?.sendPresenceUpdate) await sock.sendPresenceUpdate("available", jid);
    } catch {}
  }, KEEPALIVE_MS);

  try { keepAliveTimer.unref?.(); } catch {}
}

// GETTING DISPLAY MODE
    function getDisplayMode() {

  // 1) control/state.json (via cache loader)

  try {

    const ctrl = loadControlStateCached();

    if (ctrl?.mode) return String(ctrl.mode).toUpperCase();

  } catch {}

  // 2) fallback to .env (you said you stored it as "mode")

  const envMode = process.env.mode || process.env.MODE || process.env.BOT_MODE || "";

  if (envMode) return String(envMode).toUpperCase();

  return "PUBLIC";

}

async function notifyOwnerConnected() {
  const jid = ownerJid();
  if (!jid) return;

  const modeText = getDisplayMode();

  const msg =
    `            🔴🟢🔵 *CONNECTED*\n` +
    `┌─────────────────────\n`+ 
    `*│ BOT:* *${BOT_NAME}*\n` +
    `*│ PREFIX:* ${getActivePrefix() || "NONE"}\n` +
    `*│ AUTHOR:* *${AUTHOR}*\n` +
    `*│ MODE:* ${modeText}\n` +
    `*│ TIME:* ${formatNowInTZ(TIMEZONE)}\n` +
    `└─────────────────────\n` +
        
`*TYPE:* _${getActivePrefix() || "NONE"}menu_ to see all available commands\n\n\n` +

`📜 This is an *Advanced Premium WhatsApp Bot* that will keep you one step ahead in any group chat and in any private chat\n\n` +

`*⚠️ DISCLAIMER:*\n This bot is not a weapon of exploitation, _USE WITH CONSENT_ \n\n\n` +
    
`*°♥️💚💙°* \n
*_SUBSCRIBE/FOLLOW_ my:*\n
*YOUTUBE CHANNEL:* _https://youtube.com/@bmedia-md?si=pBBccaiisXNzxaBr_ \n
*WHATSAPP CHANNEL:* _https://whatsapp.com/channel/0029Vb4y4trHVvTbIjozUD45_ \n
*WHATSAPP GROUP:*  _https://chat.whatsapp.com/DYtICmmjotB0nkzTvZDjCm?mode=hqctcla_   
\n\n` +
        
`*👨‍💻 CONTACT DEVELOPER VIA:* _https://tinyurl.com/fw5n293r_ \n\n REPORT A BUG/PROBLEM TO THE DEVELOPER IF YOU ENCOUNTER ANY\n\n`+
        
`*DONATE:* You can send a token of appreciation to the developer. contact him usingthe link above \n\n` +


 `*REPO ✨:* ${REPO_URL}\n\n` +
        
 `> *POWERED BY BMEDIA*`;

  await safeSend(jid, { text: msg });
}
// ----------------------------- PAIRING (KEEP WORKING) -----------------------------
function askOnConsole(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans); }));
}

async function prepareOwnerNumberIfMissing() {
  if (ownerNumberCache) return;
  const envNum = sanitizePhone(PHONE_NUMBER || OWNER_NUMBER);
  if (envNum) { ownerNumberCache = envNum; return; }

  const n = await askOnConsole("Enter your WhatsApp number (example: +237679261475): ");
  ownerNumberCache = sanitizePhone(n);

  if (!ownerNumberCache) {
    console.log("❌ Invalid number. Example: +237679261475");
    process.exit(1);
  }
}

// ----------------------------- START BOT -----------------------------
async function startBot() {
  await cleanupSocket();

  if (!runtimeStateRestored && mongoSessionReady()) {
    try {
      const restored = await restoreRuntimeStateFromSession({
        sessionId: SESSION_ID,
        mongoUri: MONGODB_URI,
        dbName: SESSION_DB_NAME,
        collectionName: SESSION_COLLECTION,
        projectRoot: __dirname,
      });
      if (restored) log("✅ Runtime state restored from MongoDB.");
    } catch (e) {
      log("⚠️ Runtime state restore failed:", e?.message || e);
    }
    runtimeStateRestored = true;
  }

  ensureControlFiles();
  ensureManifestLoaded();
  // Commands are loaded on demand from manifest.json to reduce RAM usage.
  ensureAutoReload();

   
    
if (

  SESSION_ID &&

  hasMongoSessionConfig({

    mongoUri: MONGODB_URI,

    dbName: SESSION_DB_NAME,

    collectionName: SESSION_COLLECTION,

  })

) {

  try {

    const hasLocalAuth = await authDirHasFiles(AUTH_DIR);

    if (!hasLocalAuth) {

      log(`🔐 Restoring auth folder from SESSION_ID: ${SESSION_ID}`);

      await restoreAuthFromSessionId({

        sessionId: SESSION_ID,

        mongoUri: MONGODB_URI,

        dbName: SESSION_DB_NAME,

        collectionName: SESSION_COLLECTION,

        authDir: AUTH_DIR,

      });

      log("✅ Session restore completed.");
      try {
        await claimSessionForRuntime({
          sessionId: SESSION_ID,
          mongoUri: MONGODB_URI,
          dbName: SESSION_DB_NAME,
          collectionName: SESSION_COLLECTION,
        });
        log("♾️ Session claimed for persistent runtime use.");
      } catch (e) {
        log("⚠️ Session claim failed:", e?.message || e);
      }

    } else {

      log("📁 Local auth folder found. Skipping SESSION_ID restore.");

    }

  } catch (e) {

    log("⚠️ Session restore failed, continuing with local/fallback auth:", e?.message || e);

  }

}

const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  log(`🔐 Auth state registered: ${state?.creds?.registered === true ? "yes" : "no"}`);

    
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger: P({ level: "silent" }),
      
      
    browser: Browsers.macOS("Chrome"),
    markOnlineOnConnect: true,
  });

    
    //DEBUGGING 

    
  //DEBUGGINGEND  
    
 sock.ev.on("creds.update", async () => {
   try { await saveCreds(); } catch (e) { log("⚠️ Local creds save failed:", e?.message || e); }
   scheduleAuthSync();
 });
 registerGroupGreetingsHandler(sock);
 startDailyBibleScheduler(sock);
    
  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update || {};

    if (connection === "open") {
      pairingRequested = false;
      whatsappConnected = true;
      authPersistenceArmed = true;
      log("✅ Connected");
      scheduleAuthSync(250);
      scheduleRuntimeStateSync(750);
      startKeepAlive();
      await notifyOwnerConnected();
      await handleStartupGroupJoin(sock);
      return;
    }

    if (connection === "close") {
      whatsappConnected = false;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      log("❌ Disconnected:", statusCode || "unknown");

      if (statusCode === DisconnectReason.loggedOut) {
        log("Logged out. Delete auth folder and re-pair.");
        return;
      }

      await sleep(1200);
      return startBot();
    }

    if (!sock?.authState?.creds?.registered && !pairingRequested) {
      // A cloud deployment that already has SESSION_ID must never generate a new
      // pairing code automatically. requestPairingCode() mutates the auth creds,
      // which can destroy the restored session snapshot if startup validation fails.
      if (SESSION_ID) {
        pairingRequested = true; // suppress repeated warnings for this socket
        log("⚠️ Restored SESSION_ID is not registered/accepted; automatic re-pairing is disabled.");
        log("⚠️ If this persists after a clean redeploy, create a fresh SESSION_ID with the pairing service.");
        return;
      }

      await prepareOwnerNumberIfMissing();

      async function requestPairingCodeOnce() {
        if (pairingRequested) return;
        pairingRequested = true;

        console.log(`\n${BOT_NAME} not linked yet.`);
        console.log("Generating pairing code...");

        try {
          await sleep(2000);
          const code = await sock.requestPairingCode(ownerNumberCache);

          console.log("\n✅ Pairing Code (RAW):", code);
          console.log("Open WhatsApp → Linked devices → Link with phone number → enter this code.");
          console.log("NOTE: After you enter code, server may show 515 (restart required). That is normal.\n");
        } catch (e) {
          pairingRequested = false;
          console.log("❌ Pairing code request failed:", e?.message || e);
        }
      }

      await requestPairingCodeOnce();
    }
  });
    
//FOR ANTIDELETE
sock.ev.on("messages.update", async (updates) => {

  await handleAntiDeleteUpdates(sock, updates);

});

sock.ev.on("messages.delete", async (deleted) => {

  await handleAntiDeleteDeleteEvent(sock, deleted);

});
    
    
  // ----------------------------- MESSAGE HANDLER -----------------------------
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      if (!Array.isArray(messages) || messages.length === 0) return;

      for (const m of messages) {
        try {
            if (await handleStatusView(sock, m)) continue;
            
          if (shouldIgnoreMessage(m)) continue;

          const from = m.key.remoteJid;
            
// cache every real incoming message for antidelete
cacheAntiDeleteMessage(m);
            
          const senderJid = getSenderJidFromMessage(m, sock);

const text = getText(m);

// _____| HELPERS CALLING |_______
await handleAntiLink(sock, m, from, senderJid);
await handleAutoReact(sock, m, from);
await handleAntiBadword(sock, m, from, senderJid);
await handleAutoRead(sock, m);
await handleAutoTyping(sock, m);
await handleAntiPorn(sock, m, from);
await handleAntiFlood(sock, m, from);
await handleAntiMentionAll(sock, m, from);
await handleAntiFake(sock, m, from);
await handleAntiBot(sock, m, from);
await handleJoinApproval(sock, m, from);
if (await handleLinuxShell(sock, m)) continue;
if (await handleAntiGroupMention(sock, m)) continue;
if (await handleGMComment(sock, m)) continue;


//GETTING CURRENT PREFIX           
const activePrefix = getActivePrefix();
            
//HANDLES THAT USE ACTIVE PREFIX
await handleAtasaAutoReply(sock, m, from, activePrefix);
await handleAntiSpam(sock, m, from, activePrefix);

     
            
    if (!text) continue;
  if (await handlePOChatbotReply(sock, m, from, senderJid, activePrefix)) continue;
            
// ------- COMMAND PARSE --------
const parsed = parseCommand(text, activePrefix);
if (!parsed) continue;

const { cmd, args } = parsed;
console.log(`COMMAND:  ${activePrefix || ""} ${cmd}`);

// ---------------------- PRIVATE MODE: SILENT IGNORE ----------------------
// If the bot is in PRIVATE mode, ignore ALL commands from non-owner and non-sudo users
// (no "Owner only", no "Private mode" message, no replies at all).
const ctrl = loadControlStateCached();
const isPrivate = String(ctrl?.mode || "").toLowerCase() === "private";

if (isPrivate) {
  const ownerOk = isOwner({ senderJid });
  const sudoOk = isSudoByJid(senderJid);
  if (!ownerOk && !sudoOk) continue;
}

// Built-in mode switch (owner only) BEFORE access gate so owner can recover.
if (cmd === "mode") {
  await handleModeCommand({ sock, m, from, prefix: activePrefix, senderJid, isOwner });
  continue;
}

// Access gate (public/private + banned + admin/sudo)
const gate = await canUseBot({ from, senderJid });
if (!gate.ok) {
  continue;
}

const command = await importCommand(cmd);
if (!command) continue;

// ⏳ React: command is about to run
await sock.sendMessage(from, { react: { text: "⏳", key: m.key } }).catch(() => {});

const ctx = {
  sock,
  m,
  from,
  sender: senderJid,   // keep existing framework field (jid)
  senderJid,
  senderLid: "",       // legacy field (no longer used)
  text,
  args,
  prefix: activePrefix,
  botName: BOT_NAME,
  author: AUTHOR,
  mode: BOT_MODE_LABEL,
  commands: commandCache,
};

try {
  await withTimeout(Promise.resolve(command.execute(ctx)), COMMAND_TIMEOUT_MS, `command "${cmd}"`);
  scheduleRuntimeStateSync();

  // ✅ React: success (replaces ⏳)
  await sock.sendMessage(from, { react: { text: "✅", key: m.key } }).catch(() => {});
} catch (e) {
  // ❌ React: failed (replaces ⏳)
  await sock.sendMessage(from, { react: { text: "❌", key: m.key } }).catch(() => {});

  const msg = String(e?.message || e || "");
  const isTimeout = msg.includes("timeout after") || msg.toLowerCase().includes("timeout");

if (isTimeout) {

  const cleared = clearTempFolder();

  try {

    await sock.sendMessage(

      from,

      {

        text:

          `❌ this command took too long and was terminated\n\n` +

          `🧹 temp cleared: ${cleared.tempRemoved} item(s)\n` +

          `🧹 download_temp cleared: ${cleared.downloadTempRemoved} item(s)\n` +

          `🧹 total cleared: ${cleared.totalRemoved} item(s)`,

      },

      { quoted: m }

    );

  } catch {}

  log(

    `⏱️ TIMEOUT: ${cmd} | temp: ${cleared.tempRemoved} | download_temp: ${cleared.downloadTempRemoved} | total: ${cleared.totalRemoved} | ${msg}`

  );

  continue;

}

  log("Message/command error:", msg);
}
 //               
                
        } catch (e) {
          log("Message loop error:", e?.message || e);
        }
      }
    } catch (e) {
      log("Upsert handler error:", e?.message || e);
    }
  });

  return sock;
}

// ----------------------------- BOOT -----------------------------
startHealthServer();
startPersistenceHeartbeat();
startBot().catch((e) => log("Start failed:", e?.message || e));
