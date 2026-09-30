// commands/statusemoji.js

import fs from "fs";

import path from "path";

import { isOwner } from "../checks/isOwner.js";

import { isSudoByJid } from "../checks/isSudo.js";

const CONTROL_DIR = path.join(process.cwd(), "control");

const STATE_FILE = path.join(CONTROL_DIR, "statusview.json");

const DEFAULT_EMOJI_STRING = "♥️,💚,💙";

function ensureStateFile() {

  try {

    if (!fs.existsSync(CONTROL_DIR)) {

      fs.mkdirSync(CONTROL_DIR, { recursive: true });

    }

    if (!fs.existsSync(STATE_FILE)) {

      fs.writeFileSync(

        STATE_FILE,

        JSON.stringify({ mode: "off", emojis: DEFAULT_EMOJI_STRING }, null, 2),

        "utf8"

      );

    }

  } catch {}

}

function parseEmojiList(input) {

  const raw = String(input || "").trim();

  if (!raw) return [];

  return raw

    .replace(/\r?\n/g, " ")

    .split(/[\s,|]+/)

    .map((x) => x.trim())

    .filter(Boolean);

}

function stringifyEmojiList(input) {

  const list = Array.isArray(input) ? input : parseEmojiList(input);

  const clean = [...new Set(list.map((x) => String(x || "").trim()).filter(Boolean))];

  return clean.length ? clean.join(",") : DEFAULT_EMOJI_STRING;

}

function loadState() {

  ensureStateFile();

  try {

    const raw = fs.readFileSync(STATE_FILE, "utf8");

    const data = JSON.parse(raw || "{}");

    const next = data && typeof data === "object" ? data : {};

    return {

      mode: ["off", "view", "react"].includes(String(next.mode || "").toLowerCase())

        ? String(next.mode).toLowerCase()

        : "off",

      emojis: stringifyEmojiList(next.emojis),

    };

  } catch {

    return {

      mode: "off",

      emojis: DEFAULT_EMOJI_STRING,

    };

  }

}

function saveState(state) {

  try {

    ensureStateFile();

    fs.writeFileSync(

      STATE_FILE,

      JSON.stringify(

        {

          mode: ["off", "view", "react"].includes(String(state?.mode || "").toLowerCase())

            ? String(state.mode).toLowerCase()

            : "off",

          emojis: stringifyEmojiList(state?.emojis),

        },

        null,

        2

      ),

      "utf8"

    );

    return true;

  } catch {

    return false;

  }

}

function isPrivileged(m, sock, senderJid) {

  try {

    if (isOwner(m, sock)) return true;

  } catch {}

  try {

    if (isSudoByJid(senderJid)) return true;

  } catch {}

  return false;

}

export default {

  name: "statusemoji",

  aliases: ["sre", "semoji"],

  category: "OWNER",

  description: "Update auto-status reaction emojis",

  usage: "statusemoji ❤️ 💚 💙 | statusemoji reset | statusemoji show",

  async execute(ctx) {

    const { sock, m, from, args, senderJid } = ctx;

    if (!isPrivileged(m, sock, senderJid)) {

      return sock.sendMessage(from, { text: "❌ Owner/Sudo only." }, { quoted: m });

    }

    const state = loadState();

    const input = String(args?.join(" ") || "").trim();

    if (!input) {

      return sock.sendMessage(

        from,

        {

          text:

            `📌 *Current status emojis:* ${state.emojis}\n\n` +

            `Usage:\n` +

            `• statusemoji ❤️ 💚 💙\n` +

            `• statusemoji reset\n` +

            `• statusemoji show`,

        },

        { quoted: m }

      );

    }

    const lower = input.toLowerCase();

    if (lower === "show") {

      return sock.sendMessage(

        from,

        { text: `📌 *Current status emojis:* ${state.emojis}` },

        { quoted: m }

      );

    }

    if (lower === "reset" || lower === "default") {

      state.emojis = DEFAULT_EMOJI_STRING;

      const ok = saveState(state);

      return sock.sendMessage(

        from,

        { text: ok ? `✅ Status emojis reset to: ${state.emojis}` : "❌ Failed to reset status emojis." },

        { quoted: m }

      );

    }

    const emojis = parseEmojiList(input);

    if (!emojis.length) {

      return sock.sendMessage(

        from,

        { text: "❌ Please provide valid emojis.\nExample: statusemoji ❤️ 💚 💙" },

        { quoted: m }

      );

    }

    state.emojis = stringifyEmojiList(emojis);

    const ok = saveState(state);

    return sock.sendMessage(

      from,

      {

        text: ok

          ? `✅ Status emojis updated to: ${state.emojis}`

          : "❌ Failed to update status emojis.",

      },

      { quoted: m }

    );

  },

};