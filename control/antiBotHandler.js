// control/antiBotHandler.js (ESM)

// AntiBot: auto-kick other bots (non-admin)

// - Detect bot-like JIDs (e.g. "...:device@s.whatsapp.net")

// - If sender is bot AND not admin => kick

// - Group-specific enable/disable

//

// Call: await handleAntiBot(sock, m, from);

import fs from "fs/promises";

import path from "path";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const STORE_PATH = path.join(__dirname, "antiBotStore.json");

function bare(id) {

  return String(id || "").split("@")[0].split(":")[0];

}

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender || null;

}

function tagOf(jid) {

  return `@${String(jid || "").split("@")[0].split(":")[0]}`;

}

async function readStore() {

  try {

    const raw = await fs.readFile(STORE_PATH, "utf8");

    const parsed = JSON.parse(raw);

    return parsed && typeof parsed === "object" ? parsed : {};

  } catch {

    return {};

  }

}

async function writeStore(data) {

  await fs.writeFile(STORE_PATH, JSON.stringify(data, null, 2), "utf8");

}

export async function getAntiBotConfig(chatId) {

  const store = await readStore();

  const cfg = store[chatId] || {};

  return {

    enabled: Boolean(cfg.enabled),

  };

}

export async function setAntiBotConfig(chatId, patch = {}) {

  const store = await readStore();

  const cur = store[chatId] || {};

  store[chatId] = { ...cur, ...patch };

  await writeStore(store);

  return store[chatId];

}

function isLikelyBotJid(jid) {

  // Most "bot-like" senders show up as number:device@s.whatsapp.net

  // Example: "237650000000:12@s.whatsapp.net"

  const s = String(jid || "");

  return s.includes(":") && s.endsWith("@s.whatsapp.net");

}

async function getParticipant(sock, groupJid, senderId) {

  const meta = await sock.groupMetadata(groupJid);

  const sb = bare(senderId);

  return (meta.participants || []).find((p) => bare(p.id) === sb) || null;

}

async function isAdminOrSuper(sock, groupJid, senderId) {

  try {

    const p = await getParticipant(sock, groupJid, senderId);

    return Boolean(p?.admin); // admin | superadmin

  } catch {

    return false;

  }

}

async function kickMember(sock, groupJid, senderId) {

  try {

    const p = await getParticipant(sock, groupJid, senderId);

    const target = p?.id || senderId;

    await sock.groupParticipantsUpdate(groupJid, [target], "remove");

    return true;

  } catch {

    return false;

  }

}

export async function handleAntiBot(sock, m, from) {

  try {

    if (!from?.endsWith("@g.us")) return;

    if (!m?.message) return;

    if (m?.key?.fromMe) return;

    const cfg = await getAntiBotConfig(from);

    if (!cfg.enabled) return;

    const sender = getSender(m);

    if (!sender) return;

    // detect other bots

    if (!isLikelyBotJid(sender)) return;

    // ignore admins/superadmins

    const admin = await isAdminOrSuper(sock, from, sender);

    if (admin) return;

    const kicked = await kickMember(sock, from, sender);

    const tag = tagOf(sender);

    if (kicked) {

      return sock.sendMessage(

        from,

        { text: `🤖🚫 *AntiBot*\n\n${tag} bot removed. 👢`, mentions: [sender] },

        { quoted: m }

      );

    }

  } catch (e) {

    console.log("[AntiBot] handler error:", e?.message || e);

  }

}