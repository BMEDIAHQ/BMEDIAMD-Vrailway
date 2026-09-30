// control/autoTypingHandler.js (ESM)

// Auto-typing presence handler (cosmetic).

// - Reads settings from: control/config.json

// - If enabled: whenever a message comes in, bot shows "typing..." briefly

// - NOT for statuses

//

// Call in index EARLY (before command execution/reply):

//   import { handleAutoTyping } from "./control/autoTypingHandler.js";

//   await handleAutoTyping(sock, m);

//

// Tip: Keep it before your command handler so it shows typing before replies.

import fs from "fs";

import path from "path";

const CONTROL_DIR = path.resolve(process.cwd(), "control");

const CONFIG_FILE = path.join(CONTROL_DIR, "config.json");

function readConfig() {

  try {

    if (!fs.existsSync(CONFIG_FILE)) return {};

    const raw = fs.readFileSync(CONFIG_FILE, "utf8");

    return raw?.trim() ? JSON.parse(raw) : {};

  } catch {

    return {};

  }

}

function isStatusJid(jid) {

  return jid === "status@broadcast";

}

function sleep(ms) {

  return new Promise((r) => setTimeout(r, ms));

}

export async function handleAutoTyping(sock, m) {

  try {

    if (!m?.message) return;

    if (m?.key?.fromMe) return;

    const remoteJid = m?.key?.remoteJid || m?.from;

    if (!remoteJid) return;

    // ✅ not statuses

    if (isStatusJid(remoteJid)) return;

    const cfg = readConfig();

    if (!cfg?.autoTyping?.enabled) return;

    // show typing briefly

    await sock.sendPresenceUpdate("composing", remoteJid).catch(() => {});

    await sleep(900);

    await sock.sendPresenceUpdate("paused", remoteJid).catch(() => {});

  } catch (e) {

    console.log("[autotyping] handler error:", e?.message || e);

  }

}