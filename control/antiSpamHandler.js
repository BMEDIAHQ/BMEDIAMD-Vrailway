// control/antiSpamHandler.js (ESM)

// Group-specific AntiSpam:

// - Rate limit: too many messages in a short window

// - Repeat spam: same text repeated too many times

// Action: delete + warn; kick when warnLimit reached

//

// Call: await handleAntiSpam(sock, m, from, activePrefix);

import fs from "fs/promises";

import path from "path";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const STORE_PATH = path.join(__dirname, "antiSpamStore.json");

// In-memory trackers (resets on restart)

const rateMap = new Map();   // key: `${chatId}:${senderBare}` => number[] timestamps(ms)

const repeatMap = new Map(); // key: `${chatId}:${senderBare}` => { lastText, count, lastAt }

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

export async function getAntiSpamConfig(chatId) {

  const store = await readStore();

  const cfg = store[chatId] || {};

  return {

    enabled: Boolean(cfg.enabled),

    windowSec: Number(cfg.windowSec ?? 8),       // time window

    maxMsgs: Number(cfg.maxMsgs ?? 5),           // max msgs within window

    repeatLimit: Number(cfg.repeatLimit ?? 3),   // same text repeats

    warnLimit: Number(cfg.warnLimit ?? 3),       // warns before kick

    warns: cfg.warns || {},                      // senderBare -> count

  };

}

export async function setAntiSpamConfig(chatId, patch = {}) {

  const store = await readStore();

  const cur = store[chatId] || {};

  store[chatId] = {

    ...cur,

    ...patch,

    warns: patch.warns ?? cur.warns ?? {},

  };

  await writeStore(store);

  return store[chatId];

}

async function isAdminOrSuper(sock, groupJid, senderId) {

  try {

    const meta = await sock.groupMetadata(groupJid);

    const sb = bare(senderId);

    const p = (meta.participants || []).find((x) => bare(x.id) === sb);

    return Boolean(p?.admin); // admin | superadmin

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

async function kickMember(sock, from, senderId) {

  try {

    const meta = await sock.groupMetadata(from);

    const sb = bare(senderId);

    const p = (meta.participants || []).find((x) => bare(x.id) === sb);

    const target = p?.id || senderId;

    await sock.groupParticipantsUpdate(from, [target], "remove");

    return true;

  } catch {

    return false;

  }

}

function isCommand(text, activePrefix) {

  if (!activePrefix) return false;

  const t = String(text || "").trimStart();

  if (!t.startsWith(activePrefix)) return false;

  const after = t.slice(activePrefix.length).trimStart(); // allows ". menu"

  return after.length > 0;

}

export async function handleAntiSpam(sock, m, from, activePrefix = "") {

  try {

    if (!from?.endsWith("@g.us")) return;

    if (!m?.message) return;

    if (m?.key?.fromMe) return;

    const cfg = await getAntiSpamConfig(from);

    if (!cfg.enabled) return;

    const sender = getSender(m);

    if (!sender) return;

    // ignore admins

    const admin = await isAdminOrSuper(sock, from, sender);

    if (admin) return;

    const text = getText(m);

    if (!text) return;

    const now = Date.now();

    const sb = bare(sender);

    const key = `${from}:${sb}`;

    // --- rate limit ---

    const windowMs = Math.max(2, cfg.windowSec) * 1000;

    const maxMsgs = Math.max(2, cfg.maxMsgs);

    const list = rateMap.get(key) || [];

    const recent = list.filter((t) => now - t <= windowMs);

    recent.push(now);

    rateMap.set(key, recent);

    const tooFast = recent.length > maxMsgs;

    // --- repeat spam (same exact text) ---

    const rep = repeatMap.get(key) || { lastText: "", count: 0, lastAt: 0 };

    const norm = text.toLowerCase().replace(/\s+/g, " ").trim();

    const withinRepeatWindow = now - rep.lastAt <= windowMs;

    if (withinRepeatWindow && norm && norm === rep.lastText) {

      rep.count += 1;

    } else {

      rep.lastText = norm;

      rep.count = 1;

    }

    rep.lastAt = now;

    repeatMap.set(key, rep);

    const repeatSpam = rep.count >= Math.max(2, cfg.repeatLimit);

    // Extra strict for command spam (same thresholds but triggers easier)

    const cmd = isCommand(text, activePrefix);

    const isSpam = tooFast || repeatSpam || (cmd && recent.length > Math.max(2, Math.floor(maxMsgs * 0.8)));

    if (!isSpam) return;

    // delete spam message

    await deleteMessage(sock, from, m);

    // increment warns

    const warns = { ...(cfg.warns || {}) };

    warns[sb] = Number(warns[sb] || 0) + 1;

    const warnLimit = Math.max(1, cfg.warnLimit || 3);

    await setAntiSpamConfig(from, { warns });

    const tag = tagOf(sender);

    // warn message

    await sock.sendMessage(

      from,

      {

        text:

          `🚫 *AntiSpam*\n\n` +

          `${tag} please stop spamming.\n` +

          `⚠️ Warn: *${warns[sb]}/${warnLimit}*`,

        mentions: [sender],

      },

      { quoted: m }

    );

    // kick if persistent

    if (warns[sb] >= warnLimit) {

      const kicked = await kickMember(sock, from, sender);

      // reset warns after kick attempt (prevents 4/3 loops)

      const fresh = await getAntiSpamConfig(from);

      const w2 = { ...(fresh.warns || {}) };

      delete w2[sb];

      await setAntiSpamConfig(from, { warns: w2 });

      if (kicked) {

        await sock.sendMessage(

          from,

          { text: `👢 Removed ${tag} (AntiSpam warn limit reached).`, mentions: [sender] }

        );

      }

    }

  } catch (e) {

    console.log("[AntiSpam] handler error:", e?.message || e);

  }

}