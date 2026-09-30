// control/mode.js (ESM)
// Minimal mode controller (public/private) persisted to ./control/state.json

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always resolve relative to this repository's control folder
const CONTROL_DIR = __dirname;
const STATE_FILE = path.join(CONTROL_DIR, "state.json");

function readJsonSafe(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    return JSON.parse(fs.readFileSync(file, "utf-8") || "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function ensureState() {
  try {
    if (!fs.existsSync(CONTROL_DIR)) fs.mkdirSync(CONTROL_DIR, { recursive: true });
    if (!fs.existsSync(STATE_FILE)) {
      const initial = { mode: "public", owners: [], sudos: [], updatedAt: Date.now() };
      fs.writeFileSync(STATE_FILE, JSON.stringify(initial, null, 2));
    }
  } catch {}
}

export function getMode() {
  ensureState();
  const st = readJsonSafe(STATE_FILE, { mode: "public" });
  return String(st?.mode || "public").toLowerCase() === "private" ? "private" : "public";
}

export function setMode(mode) {
  ensureState();
  const m = String(mode || "").toLowerCase();
  const nextMode = m === "private" ? "private" : "public";
  const st = readJsonSafe(STATE_FILE, { mode: "public", owners: [], sudos: [] });
  const next = { ...st, mode: nextMode, updatedAt: Date.now() };
  fs.writeFileSync(STATE_FILE, JSON.stringify(next, null, 2));
  return nextMode;
}

// Built-in mode switch handler (owner only)
export async function handleModeCommand({ sock, m, from, prefix, senderJid, isOwner }) {
  if (!isOwner({ senderJid })) {
    await sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });
    return true;
  }
  const parts = String(
    m?.message?.conversation ||
    m?.message?.extendedTextMessage?.text ||
    ""
  ).trim().split(/\s+/);

  // parts[0] is like "!mode"; rest are args
  const want = String(parts?.[1] || "").toLowerCase();
  const current = getMode();

  if (!want) {
    await sock.sendMessage(
      from,
      { text: `⚙️ Mode: *${current.toUpperCase()}*\nUse: ${prefix}mode public | ${prefix}mode private` },
      { quoted: m }
    );
    return true;
  }

  if (want !== "public" && want !== "private") {
    await sock.sendMessage(
      from,
      { text: `❌ Invalid mode.\nUse: ${prefix}mode public | ${prefix}mode private` },
      { quoted: m }
    );
    return true;
  }

  const updated = setMode(want);
  await sock.sendMessage(from, { text: `✅ Mode set to *${updated.toUpperCase()}*.` }, { quoted: m });
  return true;
}

export default { getMode, setMode, handleModeCommand };
