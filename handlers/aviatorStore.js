// handlers/aviatorStore.js
import fs from "fs/promises";
import path from "path";

export const CONTROL_DIR = path.join(process.cwd(), "control");
export const STATE_PATH = path.join(CONTROL_DIR, "aviator.json");
export const DEFAULT_DAILY_REWARD = 100;
export const STARTING_WALLET = 0;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeUserJid(jid = "") {
  const s = String(jid || "").trim();
  if (!s) return "";
  if (s.endsWith("@g.us")) return s;
  const left = s.split("@")[0].split(":")[0];
  return left ? `${left}@s.whatsapp.net` : "";
}

export function visibleUserId(id) {
  return `U${String(id || "")}`;
}

function emptyState() {
  return {
    lastResetDate: todayKey(),
    nextUserId: 1000,
    users: {},
    userIds: {},
    chats: {},
  };
}

export async function readAviatorState() {
  try {
    const raw = await fs.readFile(STATE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      lastResetDate: parsed?.lastResetDate || todayKey(),
      nextUserId: Number.isFinite(parsed?.nextUserId) ? parsed.nextUserId : 1000,
      users: typeof parsed?.users === "object" && parsed.users ? parsed.users : {},
      userIds: typeof parsed?.userIds === "object" && parsed.userIds ? parsed.userIds : {},
      chats: typeof parsed?.chats === "object" && parsed.chats ? parsed.chats : {},
    };
  } catch {
    return emptyState();
  }
}

export async function writeAviatorState(state) {
  await fs.mkdir(CONTROL_DIR, { recursive: true });
  await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf8");
}

export function ensureDailyReset(state) {
  const today = todayKey();
  if (state.lastResetDate !== today) {
    state.lastResetDate = today;
    state.chats = {};
  }
  return state;
}

export function getUser(state, jid) {
  const userJid = normalizeUserJid(jid);
  if (!userJid) return null;

  let rec = state.users[userJid];
  if (!rec) {
    const id = state.nextUserId++;
    rec = {
      id,
      jid: userJid,
      wallet: STARTING_WALLET,
      bank: 0,
      lastDaily: "",
      totalClaimed: 0,
      totalWon: 0,
      totalLost: 0,
      totalPlayed: 0,
      totalDeposited: 0,
      totalWithdrawn: 0,
      totalTransferredIn: 0,
      totalTransferredOut: 0,
      totalCredited: 0,
      createdAt: new Date().toISOString(),
    };
    state.users[userJid] = rec;
    state.userIds[String(id)] = userJid;
  }
  return rec;
}

export function getUserById(state, idOrVisible) {
  const raw = String(idOrVisible || "").trim().toUpperCase();
  const clean = raw.startsWith("U") ? raw.slice(1) : raw;
  const jid = state.userIds[clean];
  if (!jid) return null;
  return state.users[jid] || null;
}

export function getChatStats(state, chatId, jid) {
  if (!state.chats[chatId]) {
    state.chats[chatId] = { players: {}, createdAt: new Date().toISOString() };
  }
  if (!state.chats[chatId].players[jid]) {
    state.chats[chatId].players[jid] = {
      played: 0,
      wins: 0,
      losses: 0,
      stakeTotal: 0,
      payoutTotal: 0,
      profit: 0,
      lastPlayedAt: "",
    };
  }
  return state.chats[chatId].players[jid];
}

export function formatCoins(n) {
  return Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function parsePositiveAmount(input) {
  const n = Number(String(input || "").replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n * 100) / 100;
}

export function parseMultiplier(input) {
  const n = Number(String(input || "").replace(/[xX]/g, "").trim());
  if (!Number.isFinite(n) || n < 1.01 || n > 100) return null;
  return Math.round(n * 100) / 100;
}

export function getSenderJid(m) {
  return normalizeUserJid(m?.key?.participant || m?.participant || m?.sender || m?.key?.remoteJid || "");
}

export function generateCrashMultiplier() {
  const r = Math.random();
  let x;
  if (r < 0.55) x = 1 + Math.random() * 1.2;
  else if (r < 0.82) x = 2.2 + Math.random() * 2.8;
  else if (r < 0.96) x = 5 + Math.random() * 7;
  else x = 12 + Math.random() * 38;
  return Math.round(x * 100) / 100;
}

export function leaderboardText(state, chatId, limit = 5) {
  const chat = state.chats[chatId];
  if (!chat || !chat.players) return "No plays yet today.";
  const rows = Object.entries(chat.players)
    .map(([jid, s]) => ({ jid, ...s }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, limit);

  if (!rows.length) return "No plays yet today.";

  return rows
    .map((row, i) => {
      const user = state.users[row.jid];
      return `${i + 1}. U${user?.id || "?"} — profit ${formatCoins(row.profit)} | W:${row.wins} L:${row.losses}`;
    })
    .join("\n");
}
