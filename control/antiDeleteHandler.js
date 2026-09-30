// control/antiDeleteHandler.js (ESM)

import fs from "fs";

import path from "path";

import { fileURLToPath } from "url";

import { downloadContentFromMessage, getContentType } from "@whiskeysockets/baileys";

const __filename = fileURLToPath(import.meta.url);

const __dirname = path.dirname(__filename);

const STORE_FILE = path.join(__dirname, "antiDeleteStore.json");

// ---------------- STORE ----------------

function readStore() {

  try {

    if (!fs.existsSync(STORE_FILE)) {

      return { enabled: false, mode: "chat", targetJid: null };

    }

    const raw = fs.readFileSync(STORE_FILE, "utf8");

    const parsed = JSON.parse(raw || "{}");

    return {

      enabled: Boolean(parsed.enabled),

      mode: parsed.mode || "chat", // chat | dm | jid

      targetJid: parsed.targetJid || null,

    };

  } catch {

    return { enabled: false, mode: "chat", targetJid: null };

  }

}

// ---------------- CACHE ----------------

// key by message id + by remoteJid|id

const cacheById = new Map();

const cacheByComposite = new Map();

const MAX_CACHE = 5000;

function trimCache() {

  while (cacheById.size > MAX_CACHE) {

    const firstKey = cacheById.keys().next().value;

    const item = cacheById.get(firstKey);

    cacheById.delete(firstKey);

    if (item?.compositeKey) cacheByComposite.delete(item.compositeKey);

  }

}

// ---------------- HELPERS ----------------

function bare(id) {

  return String(id || "").split("@")[0].split(":")[0];

}

function isGroupJid(jid) {

  return String(jid || "").endsWith("@g.us");

}

function normalizePhoneJid(primary, alt) {

  for (const cand of [alt, primary]) {

    if (!cand) continue;

    const s = String(cand);

    if (/@s\.whatsapp\.net$/i.test(s)) {

      const n = bare(s).replace(/[^\d]/g, "");

      if (n) return `${n}@s.whatsapp.net`;

    }

    if (/@lid$/i.test(s)) continue;

    if (/@g\.us$/i.test(s)) continue;

    const n = bare(s).replace(/[^\d]/g, "");

    if (n) return `${n}@s.whatsapp.net`;

  }

  return null;

}

function ownerJidFromEnv(sock) {

  const envNum =

    process.env.OWNER_NUMBER ||

    process.env.OWNER ||

    process.env.BOT_OWNER ||

    "";

  const n = String(envNum).replace(/[^\d]/g, "");

  if (n) return `${n}@s.whatsapp.net`;

  const me = sock?.user?.id ? bare(sock.user.id).replace(/[^\d]/g, "") : "";

  if (me) return `${me}@s.whatsapp.net`;

  return null;

}

function tagOf(jid) {

  return `@${bare(jid)}`;

}

function unwrapMessage(msg) {

  if (!msg) return null;

  if (msg.ephemeralMessage?.message) return unwrapMessage(msg.ephemeralMessage.message);

  if (msg.viewOnceMessage?.message) return unwrapMessage(msg.viewOnceMessage.message);

  if (msg.viewOnceMessageV2?.message) return unwrapMessage(msg.viewOnceMessageV2.message);

  if (msg.viewOnceMessageV2Extension?.message) return unwrapMessage(msg.viewOnceMessageV2Extension.message);

  if (msg.documentWithCaptionMessage?.message) return unwrapMessage(msg.documentWithCaptionMessage.message);

  return msg;

}

function getRealContent(msg) {

  const unwrapped = unwrapMessage(msg);

  if (!unwrapped) return null;

  const type = getContentType(unwrapped);

  return { type, content: type ? unwrapped[type] : null, raw: unwrapped };

}

function shouldCacheMessage(m) {

  if (!m?.key?.id) return false;

  if (!m?.message) return false;

  const real = getRealContent(m.message);

  if (!real?.type) return false;

  // skip delete / protocol / stubs so they don't overwrite original content

  if (real.type === "protocolMessage") return false;

  if (m.messageStubType) return false;

  if (real.type === "senderKeyDistributionMessage") return false;

  if (real.type === "messageContextInfo") return false;

  if (real.type === "reactionMessage") return false;

  return true;

}

function getTextFromMessage(msg) {

  const real = getRealContent(msg);

  if (!real?.raw) return "";

  const m = real.raw;

  return (

    m.conversation ||

    m.extendedTextMessage?.text ||

    m.imageMessage?.caption ||

    m.videoMessage?.caption ||

    m.documentMessage?.caption ||

    ""

  ).trim();

}

function getMediaKind(msg) {

  const real = getRealContent(msg);

  if (!real?.type) return null;

  switch (real.type) {

    case "imageMessage":

      return "image";

    case "videoMessage":

      return "video";

    case "audioMessage":

      return "audio";

    case "documentMessage":

      return "document";

    case "stickerMessage":

      return "sticker";

    default:

      return null;

  }

}

async function streamToBuffer(stream) {

  const chunks = [];

  for await (const c of stream) chunks.push(c);

  return Buffer.concat(chunks);

}

async function getDisplayName(sock, jid, fallback = "Unknown") {

  try {

    const name = await sock.getName(jid);

    return name || fallback;

  } catch {

    return fallback;

  }

}

function buildCompositeKey(key) {

  return `${key?.remoteJid || ""}|${key?.id || ""}`;

}

// ---------------- CACHE API ----------------

export function cacheAntiDeleteMessage(m) {

  try {

    if (!shouldCacheMessage(m)) return;

    const compositeKey = buildCompositeKey(m.key);

    const entry = {

      key: m.key,

      message: m.message,

      pushName: m.pushName || "",

      compositeKey,

      cachedAt: Date.now(),

    };

    cacheById.set(m.key.id, entry);

    cacheByComposite.set(compositeKey, entry);

    trimCache();

  } catch (e) {

    console.log("[ANTIDELETE] cache error:", e?.message || e);

  }

}

function findCachedMessage(key) {

  if (!key?.id) return null;

  const compositeKey = buildCompositeKey(key);

  return cacheByComposite.get(compositeKey) || cacheById.get(key.id) || null;

}

// ---------------- DESTINATION ----------------

function getDestinationJid(sock, originalKey) {

  const cfg = readStore();

  if (!cfg.enabled) return null;

  if (cfg.mode === "chat") {

    return originalKey?.remoteJid || null;

  }

  if (cfg.mode === "dm") {

    return ownerJidFromEnv(sock);

  }

  if (cfg.mode === "jid") {

    return cfg.targetJid || null;

  }

  return null;

}

// ---------------- ACTOR / SENDER RESOLUTION ----------------

function resolveOriginalSenderJid(sock, cached) {

  const key = cached?.key || {};

  const ownerJid = ownerJidFromEnv(sock);

  if (isGroupJid(key.remoteJid)) {

    return (

      normalizePhoneJid(

        key.participant,

        key.participantAlt

      ) ||

      normalizePhoneJid(cached?.message?.extendedTextMessage?.contextInfo?.participant, null) ||

      null

    );

  }

  // private chat

  if (key.fromMe) return ownerJid;

  return (

    normalizePhoneJid(key.remoteJid, key.remoteJidAlt) ||

    normalizePhoneJid(key.participant, key.participantAlt) ||

    null

  );

}

function resolveDeletedByJid(sock, deletedKey, cached) {

  const ownerJid = ownerJidFromEnv(sock);

  if (isGroupJid(deletedKey?.remoteJid)) {

    return (

      normalizePhoneJid(deletedKey?.participant, deletedKey?.participantAlt) ||

      resolveOriginalSenderJid(sock, cached) ||

      ownerJid

    );

  }

  // private chat:

  // if the original cached message was fromMe, owner deleted it

  // else the other person deleted it

  if (cached?.key?.fromMe) return ownerJid;

  return (

    normalizePhoneJid(deletedKey?.remoteJid, deletedKey?.remoteJidAlt) ||

    resolveOriginalSenderJid(sock, cached) ||

    ownerJid

  );

}

async function resolveChatLabel(sock, deletedKey, cached) {

  if (isGroupJid(deletedKey?.remoteJid)) {

    try {

      const meta = await sock.groupMetadata(deletedKey.remoteJid);

      return meta?.subject || deletedKey.remoteJid;

    } catch {

      return deletedKey.remoteJid || "Unknown group";

    }

  }

  // private chat: show the OTHER person, not the owner

  const ownerJid = ownerJidFromEnv(sock);

  const chatJid =

    normalizePhoneJid(deletedKey?.remoteJid, deletedKey?.remoteJidAlt) ||

    normalizePhoneJid(cached?.key?.remoteJid, cached?.key?.remoteJidAlt) ||

    null;

  if (!chatJid) return "Private chat";

  if (ownerJid && bare(chatJid) === bare(ownerJid)) {

    return "Saved Messages";

  }

  return await getDisplayName(sock, chatJid, bare(chatJid));

}

// ---------------- SEND RESTORED ----------------

async function sendRestored(sock, deletedKey, cached) {

  if (!cached?.message) return;

  const dest = getDestinationJid(sock, deletedKey);

  if (!dest) return;

  const senderJid = resolveOriginalSenderJid(sock, cached);

  const deletedByJid = resolveDeletedByJid(sock, deletedKey, cached);

  const chatLabel = await resolveChatLabel(sock, deletedKey, cached);

  const text = getTextFromMessage(cached.message);

  const mediaKind = getMediaKind(cached.message);

  const real = getRealContent(cached.message);

  const media = real?.content || null;

  const typeLabel = real?.type || "unknown";

  const mentions = [];

  if (senderJid) mentions.push(senderJid);

  if (deletedByJid && bare(deletedByJid) !== bare(senderJid)) mentions.push(deletedByJid);

  const header =

    `🛑 *ANTI-DELETE*\n` +

    `👤 *Sender:* ${senderJid ? tagOf(senderJid) : "Unknown"}\n` +

    `💬 *Chat:* ${chatLabel}\n` +

    `🧩 *Type:* ${typeLabel}`;

  // text only

  if (!mediaKind) {

    const body = text

      ? `\n\n📝 *Deleted message:*\n${text}`

      : `\n\n⚠️ *Deleted message detected, but content could not be restored.*`;

    return sock.sendMessage(

      dest,

      {

        text: header + body,

        mentions,

      },

      {}

    );

  }

  // media

  try {

    const stream = await downloadContentFromMessage(media, mediaKind);

    const buffer = await streamToBuffer(stream);

    const caption =

      header + (text ? `\n\n📝 *Caption:*\n${text}` : "");

    if (mediaKind === "image") {

      return sock.sendMessage(dest, { image: buffer, caption, mentions }, {});

    }

    if (mediaKind === "video") {

      return sock.sendMessage(dest, { video: buffer, caption, mentions }, {});

    }

    if (mediaKind === "audio") {

      return sock.sendMessage(

        dest,

        {

          audio: buffer,

          mimetype: media?.mimetype || "audio/ogg; codecs=opus",

          ptt: Boolean(media?.ptt),

          caption,

          mentions,

        },

        {}

      );

    }

    if (mediaKind === "document") {

      return sock.sendMessage(

        dest,

        {

          document: buffer,

          mimetype: media?.mimetype || "application/octet-stream",

          fileName: media?.fileName || "deleted-file",

          caption,

          mentions,

        },

        {}

      );

    }

    if (mediaKind === "sticker") {

      // sticker cannot carry caption -> send ONLY once as text fallback before sticker

      await sock.sendMessage(dest, { text: header, mentions }, {});

      return sock.sendMessage(dest, { sticker: buffer }, {});

    }

    return sock.sendMessage(dest, { text: header, mentions }, {});

  } catch (e) {

    const body = text

      ? `\n\n📝 *Deleted message:*\n${text}`

      : `\n\n⚠️ *Media was deleted, but it could not be downloaded.*`;

    return sock.sendMessage(

      dest,

      {

        text: header + body,

        mentions,

      },

      {}

    );

  }

}

// ---------------- EVENT HANDLERS ----------------

async function processDeletedKey(sock, deletedKey) {

  try {

    const cfg = readStore();

    if (!cfg.enabled) return;

    const cached = findCachedMessage(deletedKey);

    if (!cached) return;

    await sendRestored(sock, deletedKey, cached);

  } catch (e) {

    console.log("[ANTIDELETE] processDeletedKey error:", e?.message || e);

  }

}

export async function handleAntiDeleteDeleteEvent(sock, deleted) {

  try {

    const cfg = readStore();

    if (!cfg.enabled) return;

    const keys = Array.isArray(deleted?.keys)

      ? deleted.keys

      : Array.isArray(deleted)

      ? deleted

      : deleted?.key

      ? [deleted.key]

      : [];

    for (const key of keys) {

      await processDeletedKey(sock, key);

    }

  } catch (e) {

    console.log("[ANTIDELETE] delete event error:", e?.message || e);

  }

}

export async function handleAntiDeleteUpdates(sock, updates) {

  try {

    const cfg = readStore();

    if (!cfg.enabled) return;

    if (!Array.isArray(updates)) return;

    for (const item of updates) {

      const key = item?.key || item?.update?.key;

      const update = item?.update || {};

      if (!key?.id) continue;

      // revoke / delete indicators

      const isDeleted =

        update?.message === null ||

        update?.messageStubType === 1 ||

        update?.messageStubType === 2 ||

        update?.message?.protocolMessage ||

        update?.protocolMessage;

      if (!isDeleted) continue;

      await processDeletedKey(sock, key);

    }

  } catch (e) {

    console.log("[ANTIDELETE] updates error:", e?.message || e);

  }

}