// control/antiMentionAllHandler.js (ESM)

// Delete messages that tag everyone / mass-mention.

// - Detects: @everyone, @all, tagall, hidetag

// - Detects: too many mentions (configurable threshold)

// - Ignores admins/superadmins

//

// Call: await handleAntiMentionAll(sock, m, from);

import fs from "fs/promises";

import path from "path";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const STORE_PATH = path.join(__dirname, "antiMentionAllStore.json");

function bare(id) {

  return String(id || "").split("@")[0].split(":")[0];

}

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender || null;

}

function tagOf(jid) {

  return `@${String(jid || "").split("@")[0].split(":")[0]}`;

}

function getText(m) {

  return (

    m?.message?.conversation ||

    m?.message?.extendedTextMessage?.text ||

    m?.message?.imageMessage?.caption ||

    m?.message?.videoMessage?.caption ||

    m?.message?.documentMessage?.caption ||

    ""

  ).trim();

}

function getMentionedJids(m) {

  const ctx = m?.message?.extendedTextMessage?.contextInfo;

  return ctx?.mentionedJid || [];

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

export async function getAntiMentionAllConfig(chatId) {

  const store = await readStore();

  const cfg = store[chatId] || {};

  return {

    enabled: Boolean(cfg.enabled),

    maxMentions: Number(cfg.maxMentions ?? 8), // if mentions >= this => delete

  };

}

export async function setAntiMentionAllConfig(chatId, patch = {}) {

  const store = await readStore();

  const cur = store[chatId] || {};

  store[chatId] = { ...cur, ...patch };

  await writeStore(store);

  return store[chatId];

}

async function isAdminOrSuper(sock, groupJid, senderId) {

  try {

    const meta = await sock.groupMetadata(groupJid);

    const sb = bare(senderId);

    const p = (meta.participants || []).find((x) => bare(x.id) === sb);

    return Boolean(p?.admin);

  } catch {

    return false;

  }

}

async function deleteMessage(sock, from, m) {

  try {

    await sock.sendMessage(from, { delete: m.key });

    return true;

  } catch {

    return false;

  }

}

function looksLikeMentionAll(text) {

  const x = String(text || "").toLowerCase();

  return (

    x.includes("@everyone") ||

    x.includes("@all") ||

    x.includes("tagall") ||

    x.includes("hidetag") ||

    x.includes("mentionall") ||

    x.includes("all members")

  );

}

export async function handleAntiMentionAll(sock, m, from) {

  try {

    if (!from?.endsWith("@g.us")) return;

    if (!m?.message) return;

    if (m?.key?.fromMe) return;

    const cfg = await getAntiMentionAllConfig(from);

    if (!cfg.enabled) return;

    const sender = getSender(m);

    if (!sender) return;

    // ignore admins/superadmins

    const admin = await isAdminOrSuper(sock, from, sender);

    if (admin) return;

    const text = getText(m);

    const mentions = getMentionedJids(m);

    const mentionCount = Array.isArray(mentions) ? mentions.length : 0;

    const massMention =

      looksLikeMentionAll(text) ||

      (mentionCount >= Math.max(5, cfg.maxMentions)); // hard floor

    if (!massMention) return;

    // delete message

    await deleteMessage(sock, from, m);

    const tag = tagOf(sender);

    // warn message

    return sock.sendMessage(

      from,

      {

        text: `🚫 *AntiMentionAll*\n\n${tag} tagging everyone is not permitted.`,

        mentions: [sender],

      },

      { quoted: m }

    );

  } catch (e) {

    console.log("[AntiMentionAll] handler error:", e?.message || e);

  }

}