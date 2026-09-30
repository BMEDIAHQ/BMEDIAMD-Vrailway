// control/autoReactHandler.js (ESM)

// Group-specific auto-react handler.

// - Reads settings from: control/config.json

// - If enabled, reacts to incoming messages with a random emoji

// - Emojis come from group config first, else from .env

//

// Call in index (after you compute from/sender):

//   import { handleAutoReact } from "./control/autoReactHandler.js";

//   await handleAutoReact(sock, m, from);

//

// Notes:

// - Ignores bot's own messages

// - Ignores non-group chats

// - Best-effort: WhatsApp may block reactions in some cases

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

function parseEmojiList(raw) {

  return String(raw || "")

    .split(/[,\n]+/)

    .map((x) => x.trim())

    .filter(Boolean);

}

function getText(m) {

  return (

    m?.message?.conversation ||

    m?.message?.extendedTextMessage?.text ||

    m?.message?.imageMessage?.caption ||

    m?.message?.videoMessage?.caption ||

    ""

  );

}

function pickRandom(arr) {

  if (!arr?.length) return "";

  return arr[Math.floor(Math.random() * arr.length)];

}

export async function handleAutoReact(sock, m, from) {

  try {

    if (!from?.endsWith("@g.us")) return;

    if (!m?.message) return;

    if (m?.key?.fromMe) return;

    // optional: skip reacting to very common "system" message types

    const type = Object.keys(m.message || {})[0] || "";

    if (!type) return;

    if (type === "protocolMessage") return;

    // If you want to avoid reacting to commands, you can uncomment this

    // const text = getText(m).trim();

    // if (text.startsWith("!") || text.startsWith(".") || text.startsWith("/")) return;

    const cfg = readConfig();

    const groupCfg = cfg?.autoReactGroups?.[from];

    if (!groupCfg?.enabled) return;

    const groupEmojis = Array.isArray(groupCfg.emojis) ? groupCfg.emojis : [];

    const envEmojis =

      parseEmojiList(process.env.AUTOREACT_EMOJIS) ||

      parseEmojiList(process.env.REACT_EMOJIS) ||

      [];

    const emojis = groupEmojis.length ? groupEmojis : envEmojis;

    if (!emojis.length) return;

    const emoji = pickRandom(emojis);

    if (!emoji) return;

    // React to the message

    await sock.sendMessage(from, { react: { text: emoji, key: m.key } }).catch(() => {});

  } catch (e) {

    // keep silent (like antilink handler style)

    console.log("[autoreact] handler error:", e?.message || e);

  }

}