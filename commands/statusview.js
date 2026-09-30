// commands/statusview.js

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

        JSON.stringify({ mode: "off", emojis: getEnvEmojiString() }, null, 2),

        "utf8"

      );

    }

  } catch {}

}

function parseEmojiList(input) {

  const raw = String(input || "").trim();

  if (!raw) return ["♥️", "💚", "💙"];

  const parts = raw

    .replace(/\r?\n/g, " ")

    .split(/[\s,|]+/)

    .map((x) => x.trim())

    .filter(Boolean);

  return parts.length ? [...new Set(parts)] : ["♥️", "💚", "💙"];

}

function stringifyEmojiList(input) {

  const list = Array.isArray(input) ? input : parseEmojiList(input);

  const clean = [...new Set(list.map((x) => String(x || "").trim()).filter(Boolean))];

  return clean.length ? clean.join(",") : DEFAULT_EMOJI_STRING;

}

function getEnvEmojiString() {

  const raw =

    process.env.STATUS_REACT_EMOJIS ||

    process.env.STATUS_EMOJIS ||

    process.env.STATUS_EMOJI ||

    "";

  return stringifyEmojiList(raw || DEFAULT_EMOJI_STRING);

}

function sanitizeState(state) {

  const mode = String(state?.mode || "").toLowerCase();

  const emojis = String(state?.emojis || "").trim()

    ? stringifyEmojiList(state.emojis)

    : getEnvEmojiString();

  return {

    mode: ["off", "view", "react"].includes(mode) ? mode : "off",

    emojis,

  };

}

function loadState() {

  ensureStateFile();

  try {

    const raw = fs.readFileSync(STATE_FILE, "utf8");

    const data = JSON.parse(raw || "{}");

    return sanitizeState(data && typeof data === "object" ? data : {});

  } catch {

    return {

      mode: "off",

      emojis: getEnvEmojiString(),

    };

  }

}

function saveState(state) {

  try {

    ensureStateFile();

    fs.writeFileSync(STATE_FILE, JSON.stringify(sanitizeState(state), null, 2), "utf8");

    return true;

  } catch {

    return false;

  }

}

function normalizeMode(input) {

  const x = String(input || "").trim().toLowerCase();

  if (["off", "disable", "0", "false", "no"].includes(x)) return "off";

  if (["on", "enable", "1", "true", "yes", "view"].includes(x)) return "view";

  if (["react", "both", "emoji"].includes(x)) return "react";

  return "";

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

  name: "statusview",

  aliases: ["autostatusview", "viewstatus", "autostatus"],

  category: "OWNER",

  description: "Control auto status view/react",

  usage: "statusview off | on | react",

  async execute(ctx) {

    const { sock, m, from, args, senderJid } = ctx;

    if (!isPrivileged(m, sock, senderJid)) {

      return sock.sendMessage(from, { text: "❌ Owner/Sudo only." }, { quoted: m });

    }

    const state = loadState();

    const input = String(args?.[0] || "").trim().toLowerCase();

    if (!input) {

      const label =

        state.mode === "off"

          ? "OFF ❌"

          : state.mode === "view"

          ? "VIEW ✅"

          : "VIEW + REACT ⚡";

      return sock.sendMessage(

        from,

        {

          text:

            `📌 *Status Mode:* ${label}\n` +

            `📌 *Status Emojis:* ${state.emojis}\n\n` +

            `*Commands:*\n` +

            `statusview off\n` +

            `statusview on\n` +

            `statusview react`,

        },

        { quoted: m }

      );

    }

    const mode = normalizeMode(input);

    if (!mode) {

      return sock.sendMessage(

        from,

        { text: "Usage:\nstatusview off\nstatusview on\nstatusview react" },

        { quoted: m }

      );

    }

    state.mode = mode;

    const ok = saveState(state);

    if (!ok) {

      return sock.sendMessage(from, { text: "❌ Failed to save status mode." }, { quoted: m });

    }

    const saved = loadState();

    const text =

      mode === "off"

        ? `✅ Status: OFF\nEmojis: ${saved.emojis}`

        : mode === "view"

        ? `✅ Status: VIEW only\nEmojis: ${saved.emojis}`

        : `✅ Status: VIEW + REACT\nEmojis: ${saved.emojis}`;

    return sock.sendMessage(from, { text }, { quoted: m });

  },

};