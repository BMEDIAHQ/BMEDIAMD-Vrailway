// control/antiPornHandler.js (ESM)

// Signature: handleAntiPorn(sock, m, from)

import fs from "fs/promises";

import path from "path";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const STORE_PATH = path.join(__dirname, "antiPornStore.json");

const DEFAULT_CFG = {

  enabled: false,

  mode: "delete", // delete | warn | kick

  warnLimit: 3,

  warns: {}, // senderBare -> count

};

// ✅ keyword list (extend as you like)

const BAD_WORDS = [

  "porn", "porno", "sex", "xxx", "hentai",

  "nude", "nudes", "nudity",

  "fuck", "f*ck", "fck",

  "dick", "pussy", "boobs", "tits",

  "blowjob", "handjob", "bj",

  "cum", "xvideos", "bangbros", "xnxx",

];

function bare(id) {

  return String(id || "").split("@")[0].split(":")[0];

}

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender || null;

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

async function writeStore(store) {

  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");

}

export async function getAntiPornConfig(chatId) {

  const store = await readStore();

  const cfg = store[chatId] || {};

  return { ...DEFAULT_CFG, ...cfg, warns: cfg.warns || {} };

}

export async function setAntiPornConfig(chatId, patch = {}) {

  const store = await readStore();

  const current = store[chatId] || {};

  const next = {

    ...DEFAULT_CFG,

    ...current,

    ...patch,

    warns: patch.warns ?? current.warns ?? {},

  };

  store[chatId] = next;

  await writeStore(store);

  return next;

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

  // Baileys delete

  try {

    await sock.sendMessage(from, { delete: m.key });

  } catch {}

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

function containsBadWord(text) {

  if (!text) return false;

  const x = text.toLowerCase();

  // match whole-ish words but still catch common variants

  return BAD_WORDS.some((w) => x.includes(w));

}

export async function handleAntiPorn(sock, m, from) {

  try {

    if (!from?.endsWith("@g.us")) return;

    if (m?.key?.fromMe) return;

    const cfg = await getAntiPornConfig(from);

    if (!cfg.enabled) return;

    const sender = getSender(m);

    if (!sender) return;

    const text = getText(m);

    if (!text) return;

    // Detect adult keywords

    if (!containsBadWord(text)) return;

    // Ignore admins

    const admin = await isAdminOrSuper(sock, from, sender);

    if (admin) return;

    // Always delete the bad message first

    await deleteMessage(sock, from, m);

    // Mode: delete (silent)

    if (cfg.mode === "delete") return;

    const sb = bare(sender);

    const warns = { ...(cfg.warns || {}) };

    warns[sb] = (warns[sb] || 0) + 1;

    // Mode: kick (immediate)

    if (cfg.mode === "kick") {

      await kickMember(sock, from, sender);

      await setAntiPornConfig(from, { warns }); // keep count if you want

      return;

    }

    // Mode: warn (warn then kick at limit)

    const limit = Number(cfg.warnLimit || 3);

    await setAntiPornConfig(from, { warns });

    const tag = `@${sender.split("@")[0].split(":")[0]}`;

    if (warns[sb] >= limit) {

      const kicked = await kickMember(sock, from, sender);

      // Optional: reset warns for that user after kick

      delete warns[sb];

      await setAntiPornConfig(from, { warns });

      return sock.sendMessage(

        from,

        {

          text: `🚫 AntiPorn\n${tag} Adult content is not permitted.\n👢 Removed (warn ${limit}/${limit})${kicked ? "" : " (kick failed)"}`,

          mentions: [sender],

        },

        { quoted: m }

      );

    }

    // Normal warn message

    return sock.sendMessage(

      from,

      {

        text: `🚫 AntiPorn\n${tag} Adult content is not permitted.\n⚠️ Warn: ${warns[sb]}/${limit}`,

        mentions: [sender],

      },

      { quoted: m }

    );

  } catch (e) {

    console.log("[AntiPorn] handler error:", e?.message || e);

  }

}