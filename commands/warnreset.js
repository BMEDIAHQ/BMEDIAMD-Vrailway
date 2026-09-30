// commands/warnreset.js (ESM)

// Owner-only (uses SAME admin/owner check method as your working antilink command)

// Resets a user's AntiLink warns for THIS group.

//

// Usage:

//   <prefix>warnreset @user

//   reply user -> <prefix>warnreset

//   <prefix>warnreset 2376xxxxxxx

//

// Storage (same as antilink handler/command):

// control/config.json

//   cfg.antiLinkWarns[groupJid][senderBare] = number

import fs from "fs";

import path from "path";

import { isOwner } from "../checks/isOwner.js";

const CONTROL_DIR = path.resolve(process.cwd(), "control");

const CONFIG_FILE = path.join(CONTROL_DIR, "config.json");

// same bare() method used in your working commands

const bare = (id) => String(id || "").split("@")[0].split(":")[0];

function ensureControlDir() {

  if (!fs.existsSync(CONTROL_DIR)) fs.mkdirSync(CONTROL_DIR, { recursive: true });

}

function readConfig() {

  try {

    if (!fs.existsSync(CONFIG_FILE)) return {};

    const raw = fs.readFileSync(CONFIG_FILE, "utf8");

    return raw?.trim() ? JSON.parse(raw) : {};

  } catch {

    return {};

  }

}

function writeConfig(cfg) {

  ensureControlDir();

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));

}

function getMentionedJid(m) {

  return m?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || "";

}

function getQuotedParticipant(m) {

  const ci = m?.message?.extendedTextMessage?.contextInfo;

  return ci?.participant || "";

}

function numberToJid(n) {

  const digits = String(n || "").replace(/[^\d]/g, "");

  if (!digits) return "";

  return `${digits}@s.whatsapp.net`;

}

function pickTarget(m, args) {

  const mentioned = getMentionedJid(m);

  if (mentioned) return mentioned;

  const quoted = getQuotedParticipant(m);

  if (quoted) return quoted;

  const typed = String((args || []).join(" ") || "").trim();

  if (!typed) return "";

  if (typed.includes("@")) return typed;

  return numberToJid(typed);

}

export default {

  name: "warnreset",

  aliases: ["resetwarn", "clearwarn", "clearwarns"],

  category: "OWNER",

  description: "Reset a user's antilink warns in this group (Owner only).",

  async execute(ctx) {

    const { sock, m, from, args, prefix } = ctx;

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "This command works in groups only." }, { quoted: m });

    }

    // ✅ SAME owner check style as your working antilink command (do not change)

    const ok = await isOwner(m, sock);

    if (!ok) {

      return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });

    }

    const target = pickTarget(m, args);

    if (!target) {

      return sock.sendMessage(

        from,

        {

          text:

            `Usage:\n` +

            `${prefix}warnreset @user\n` +

            `Reply a user then: ${prefix}warnreset\n` +

            `${prefix}warnreset 2376xxxxxxx`,

        },

        { quoted: m }

      );

    }

    const cfg = readConfig();

    cfg.antiLinkWarns = cfg.antiLinkWarns || {};

    cfg.antiLinkWarns[from] = cfg.antiLinkWarns[from] || {};

    const key = bare(target);

    const before = parseInt(cfg.antiLinkWarns[from][key] || 0, 10) || 0;

    // reset

    cfg.antiLinkWarns[from][key] = 0;

    writeConfig(cfg);

    // ✅ Tagging exactly like your working method

    const senderToMention = target;

    const tag = `@${senderToMention.split("@")[0].split(":")[0]}`;

    return sock.sendMessage(

      from,

      {

        text: `✅ Warns reset.\n${tag}\nPrevious: ${before}\nNow: 0`,

        mentions: [senderToMention],

      },

      { quoted: m }

    );

  },

};