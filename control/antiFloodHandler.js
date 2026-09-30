// control/antiFloodHandler.js (ESM)

// AntiFlood: block "too many messages in X seconds"

// - deletes flood messages

// - warns the sender

// - kicks when warnLimit reached

//

// Call: await handleAntiFlood(sock, m, from);

import fs from "fs/promises";

import path from "path";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const STORE_PATH = path.join(__dirname, "antiFloodStore.json");

// in-memory per runtime (fast + light)

const floodMap = new Map(); // key `${chatId}:${senderBare}` => timestamps[]

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

export async function getAntiFloodConfig(chatId) {

  const store = await readStore();

  const cfg = store[chatId] || {};

  return {

    enabled: Boolean(cfg.enabled),

    windowSec: Number(cfg.windowSec ?? 6), // X seconds

    maxMsgs: Number(cfg.maxMsgs ?? 6),     // too many messages

    warnLimit: Number(cfg.warnLimit ?? 3), // warns before kick

    warns: cfg.warns || {},                // senderBare -> warns

  };

}

export async function setAntiFloodConfig(chatId, patch = {}) {

  const store = await readStore();

  const cur = store[chatId] || {};

  store[chatId] = { ...cur, ...patch, warns: patch.warns ?? cur.warns ?? {} };

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

export async function handleAntiFlood(sock, m, from) {

  try {

    if (!from?.endsWith("@g.us")) return;

    if (!m?.message) return;

    if (m?.key?.fromMe) return;

    const cfg = await getAntiFloodConfig(from);

    if (!cfg.enabled) return;

    const sender = getSender(m);

    if (!sender) return;

    // ignore admins/superadmins

    const admin = await isAdminOrSuper(sock, from, sender);

    if (admin) return;

    const sb = bare(sender);

    const key = `${from}:${sb}`;

    const now = Date.now();

    const windowMs = Math.max(2, cfg.windowSec) * 1000;

    const maxMsgs = Math.max(2, cfg.maxMsgs);

    const times = floodMap.get(key) || [];

    const recent = times.filter((t) => now - t <= windowMs);

    recent.push(now);

    floodMap.set(key, recent);

    // Not flooding yet

    if (recent.length <= maxMsgs) return;

    // Flood detected: delete this message

    await deleteMessage(sock, from, m);

    // Add warn

    const warns = { ...(cfg.warns || {}) };

    warns[sb] = Number(warns[sb] || 0) + 1;

    const warnLimit = Math.max(1, cfg.warnLimit || 3);

    await setAntiFloodConfig(from, { warns });

    const tag = tagOf(sender);

    await sock.sendMessage(

      from,

      {

        text:

          `🌊 *AntiFlood*\n\n` +

          `${tag} too many messages.\n` +

          `⏱️ Limit: *${maxMsgs}* msgs / *${cfg.windowSec}s*\n` +

          `⚠️ Warn: *${warns[sb]}/${warnLimit}*`,

        mentions: [sender],

      },

      { quoted: m }

    );

    // Kick at warn limit

    if (warns[sb] >= warnLimit) {

      const kicked = await kickMember(sock, from, sender);

      // reset warns after kick attempt (prevents 4/3 loops)

      const fresh = await getAntiFloodConfig(from);

      const w2 = { ...(fresh.warns || {}) };

      delete w2[sb];

      await setAntiFloodConfig(from, { warns: w2 });

      if (kicked) {

        await sock.sendMessage(

          from,

          { text: `👢 Removed ${tag} (AntiFlood warn limit reached).`, mentions: [sender] }

        );

      }

    }

  } catch (e) {

    console.log("[AntiFlood] handler error:", e?.message || e);

  }

}