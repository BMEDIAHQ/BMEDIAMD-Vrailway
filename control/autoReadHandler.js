// control/autoReadHandler.js (ESM)

// Auto-read handler (NOT statuses).

// - Reads settings from: control/config.json

// - If enabled, marks chats as read for incoming messages (non-status)

//

// Call in index (like your other handlers):

//   import { handleAutoRead } from "./control/autoReadHandler.js";

//   await handleAutoRead(sock, m);

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

export async function handleAutoRead(sock, m) {

  try {

    if (!m?.message) return;

    if (m?.key?.fromMe) return;

    const remoteJid = m?.key?.remoteJid || m?.from;

    if (!remoteJid) return;

    // ✅ Not statuses

    if (isStatusJid(remoteJid)) return;

    const cfg = readConfig();

    if (!cfg?.autoRead?.enabled) return;

    await sock.readMessages([m.key]).catch(() => {});

  } catch (e) {

    console.log("[autoread] handler error:", e?.message || e);

  }

}