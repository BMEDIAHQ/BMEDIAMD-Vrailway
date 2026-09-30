// control/statusViewHandler.js

// One import + one line integration:

//   import handleStatusView from "./control/statusViewHandler.js"

//   if (await handleStatusView(sock, m)) continue;

//

// Returns:

//   true  -> this message was a status event, stop normal command parsing

//   false -> not a status event, continue normal bot flow

//

// FIXED:

//   - mode: off   -> do nothing

//   - mode: view  -> mark status as viewed

//   - mode: react -> mark status as viewed + react

//   - no reacted JSON file (memory only)

//   - supports status author coming as @lid

//   - also uses remoteJidAlt / participantAlt / participantPn phone JID for real view receipt

import fs from "fs";

import path from "path";

const CONTROL_DIR = path.join(process.cwd(), "control");

const STATE_FILE = path.join(CONTROL_DIR, "statusview.json");

const REACT_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

const reactedCache = new Map();

const ENV_EMOJIS = parseEmojiList(

  process.env.STATUS_EMOJIS ||

    process.env.STATUS_REACT_EMOJIS ||

    process.env.STATUS_EMOJI ||

    "💚"

);

function parseEmojiList(input) {

  const raw = String(input || "").trim();

  if (!raw) return ["💚"];

  const parts = raw

    .replace(/\r?\n/g, " ")

    .split(/[\s,|]+/)

    .map((x) => x.trim())

    .filter(Boolean);

  return parts.length ? [...new Set(parts)] : ["💚"];

}

function loadState() {

  try {

    if (!fs.existsSync(CONTROL_DIR)) return {};

    if (!fs.existsSync(STATE_FILE)) return {};

    const raw = fs.readFileSync(STATE_FILE, "utf8");

    const data = JSON.parse(raw || "{}");

    return data && typeof data === "object" ? data : {};

  } catch {

    return {};

  }

}

function getMode(state) {

  return String(state?.mode || "off").toLowerCase();

}

function getEmojiList(state) {

  if (Array.isArray(state?.emojis)) {

    const arr = state.emojis.map((x) => String(x || "").trim()).filter(Boolean);

    if (arr.length) return [...new Set(arr)];

  }

  if (typeof state?.emojis === "string" && state.emojis.trim()) {

    const parsed = parseEmojiList(state.emojis);

    if (parsed.length) return parsed;

  }

  return ENV_EMOJIS;

}

function normalizePhoneJid(raw) {

  const s = String(raw || "").trim();

  if (!s) return "";

  const num = s.split("@")[0].split(":")[0].replace(/[^0-9]/g, "");

  return num ? `${num}@s.whatsapp.net` : "";

}

function normalizeMe(sock) {

  return normalizePhoneJid(sock?.user?.id || sock?.user?.jid || "");

}

function getStatusTargets(m) {

  const lidCandidates = [

    m?.key?.participant,

    m?.participant,

    m?.message?.messageContextInfo?.participant,

  ];

  const phoneCandidates = [

    m?.key?.participantAlt,

    m?.participantAlt,

    m?.key?.remoteJidAlt,

    m?.remoteJidAlt,

    m?.key?.participantPn,

    m?.participantPn,

  ];

  let lid = "";

  let phone = "";

  for (const x of lidCandidates) {

    const raw = String(x || "").trim();

    if (raw && raw.endsWith("@lid")) {

      lid = raw;

      break;

    }

  }

  for (const x of phoneCandidates) {

    const jid = normalizePhoneJid(x);

    if (jid) {

      phone = jid;

      break;

    }

  }

  // fallback: if participant is already a normal phone jid

  if (!phone) {

    for (const x of lidCandidates) {

      const raw = String(x || "").trim();

      if (raw && raw.endsWith("@s.whatsapp.net")) {

        phone = normalizePhoneJid(raw);

        break;

      }

    }

  }

  return {

    lid,

    phone,

    all: [...new Set([lid, phone].filter(Boolean))],

  };

}

function isStatusMessage(m) {

  return m?.key?.remoteJid === "status@broadcast";

}

function unwrapMessageContent(message) {

  let msg = message || {};

  for (let i = 0; i < 5; i++) {

    if (msg?.ephemeralMessage?.message) {

      msg = msg.ephemeralMessage.message;

      continue;

    }

    if (msg?.viewOnceMessage?.message) {

      msg = msg.viewOnceMessage.message;

      continue;

    }

    if (msg?.viewOnceMessageV2?.message) {

      msg = msg.viewOnceMessageV2.message;

      continue;

    }

    if (msg?.documentWithCaptionMessage?.message) {

      msg = msg.documentWithCaptionMessage.message;

      continue;

    }

    break;

  }

  return msg || {};

}

function isReactableStatus(m) {

  const msg = unwrapMessageContent(m?.message);

  if (!msg || typeof msg !== "object") return false;

  if (msg.reactionMessage) return false;

  return Boolean(

    msg.conversation ||

      msg.extendedTextMessage ||

      msg.imageMessage ||

      msg.videoMessage ||

      msg.audioMessage ||

      msg.stickerMessage ||

      msg.documentMessage

  );

}

function makeStatusKey(m, participant) {

  const id = String(m?.key?.id || "");

  if (!id) return null;

  return {

    remoteJid: "status@broadcast",

    id,

    fromMe: false,

    participant: participant || undefined,

  };

}

function makeReactionCacheKey(m, author) {

  const id = String(m?.key?.id || "");

  return id && author ? `${author}|${id}` : "";

}

function pruneReactionCache() {

  const now = Date.now();

  for (const [key, ts] of reactedCache.entries()) {

    if (typeof ts !== "number" || now - ts > REACT_TTL_MS) {

      reactedCache.delete(key);

    }

  }

}

function hasReacted(cacheKey) {

  pruneReactionCache();

  if (!cacheKey) return true;

  const ts = reactedCache.get(cacheKey);

  return typeof ts === "number" && Date.now() - ts <= REACT_TTL_MS;

}

function markReacted(cacheKey) {

  if (!cacheKey) return;

  pruneReactionCache();

  reactedCache.set(cacheKey, Date.now());

}

function pickRandom(list) {

  return list[Math.floor(Math.random() * list.length)] || "💚";

}

async function markStatusViewed(sock, m, targets) {

  const id = String(m?.key?.id || "");

  if (!id) return false;

  // 1) original raw key

  try {

    await sock.readMessages([m.key]);

  } catch {}

  // 2) explicit keys for each participant target

  for (const participant of targets.all) {

    try {

      const key = makeStatusKey(m, participant);

      await sock.readMessages([key]);

    } catch {}

  }

  // 3) send explicit read receipt for every available participant target

  for (const participant of targets.all) {

    try {

      if (typeof sock.sendReceipt === "function") {

        await sock.sendReceipt("status@broadcast", participant, [id], "read");

        return true;

      }

    } catch {}

  }

  // 4) final fallback using raw key participant if present

  try {

    if (typeof sock.sendReceipt === "function") {

      await sock.sendReceipt(

        "status@broadcast",

        m?.key?.participant || targets.phone || targets.lid,

        [id],

        "read"

      );

      return true;

    }

  } catch {}

  // even if receipt isn't confirmed, at least readMessages was attempted

  return true;

}

// REPLACE ONLY THIS FUNCTION
// Fixes status reaction while keeping your current view logic working

async function sendStatusReaction(sock, m, targets, emoji) {
  if (!emoji) return false;

  const rawParticipant = String(m?.key?.participant || "").trim();

  const authors = [
    rawParticipant,
    targets.lid,
    targets.phone,
  ].filter(Boolean);

  const uniqueAuthors = [...new Set(authors)];

  const jidLists = [
    [...new Set([targets.phone].filter(Boolean))],
    [...new Set([targets.lid].filter(Boolean))],
    [...new Set([rawParticipant].filter(Boolean))],
    [...new Set([targets.phone, targets.lid].filter(Boolean))],
    [...new Set([rawParticipant, targets.phone, targets.lid].filter(Boolean))],
  ].filter(list => list.length);

  for (const author of uniqueAuthors) {
    const key = {
      ...m.key,
      remoteJid: "status@broadcast",
      participant: author,
      fromMe: false,
    };

    for (const statusJidList of jidLists) {
      try {
        await sock.sendMessage(
          "status@broadcast",
          {
            react: {
              text: emoji,
              key,
            },
          },
          {
            statusJidList,
          }
        );
        return true;
      } catch {}

      try {
        await sock.relayMessage(
          "status@broadcast",
          {
            reactionMessage: {
              key,
              text: emoji,
            },
          },
          {
            statusJidList,
          }
        );
        return true;
      } catch {}
    }
  }

  return false;
}

export default async function handleStatusView(sock, m) {

  try {

    if (!sock || !m?.key) return false;

    if (!isStatusMessage(m)) return false;

    const state = loadState();

    const mode = getMode(state);

    if (mode === "off") return true;

    const targets = getStatusTargets(m);

    const me = normalizeMe(sock);

    if (!targets.lid && !targets.phone) return true;

    if (m?.key?.fromMe) return true;

    if (targets.phone && targets.phone === me) return true;

    // VIEW

    if (mode === "view" || mode === "react") {

      await markStatusViewed(sock, m, targets);

    }

    // REACT

    if (mode !== "react") return true;

    if (!isReactableStatus(m)) return true;

    const authorForCache = targets.phone || targets.lid;

    const cacheKey = makeReactionCacheKey(m, authorForCache);

    if (hasReacted(cacheKey)) return true;

    const emoji = pickRandom(getEmojiList(state));

    const ok = await sendStatusReaction(sock, m, targets, emoji);

    if (ok) markReacted(cacheKey);

    return true;

  } catch {

    return true;

  }

}