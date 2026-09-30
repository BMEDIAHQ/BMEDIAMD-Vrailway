// commands/antibadword.js (ESM)

// Owner-only controller (same owner check as your antilink command: isOwner(m, sock))

// Group-specific settings stored in: control/config.json

//

// Commands:

//   antibadword on

//   antibadword off

//   antibadword add word1,word2,word3

//   antibadword del word1,word2

//   antibadword list

//   antibadword clear

//

// Notes:

// - Matching is "contains" (substring). Keep words specific (e.g., "idiot", not "id").

// - Admins are ignored by the handler.

import fs from "fs";

import path from "path";

import { isOwner } from "../checks/isOwner.js";

const CONTROL_DIR = path.resolve(process.cwd(), "control");

const CONFIG_FILE = path.join(CONTROL_DIR, "config.json");

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

function splitWords(raw) {

  return String(raw || "")

    .split(/[,\n]+/)

    .map((w) => String(w || "").trim().toLowerCase())

    .filter(Boolean);

}

export default {

  name: "antibadword",

  aliases: ["badword", "antitoxic"],

  category: "GROUP",

  description: "Group badword filter (Owner only controls).",

  async execute(ctx) {

    const { sock, m, from, args, prefix } = ctx;

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "This command works in groups only." }, { quoted: m });

    }

    // ✅ Owner only (same as AntiLink)

    const ok = await isOwner(m, sock);

    if (!ok) return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });

    const sub = String(args?.[0] || "").toLowerCase();

    const cfg = readConfig();

    cfg.antiBadwordGroups = cfg.antiBadwordGroups || {};

    cfg.antiBadwordGroups[from] = cfg.antiBadwordGroups[from] || { enabled: false, words: [] };

    const g = cfg.antiBadwordGroups[from];

    if (!sub || sub === "status") {

      return sock.sendMessage(

        from,

        {

          text:

            `🛡️ AntiBadword (This Group)\n` +

            `• Enabled: ${g.enabled ? "ON ✅" : "OFF ❌"}\n` +

            `• Words: ${Array.isArray(g.words) ? g.words.length : 0}\n\n` +

            `Commands:\n` +

            `${prefix}antibadword on\n` +

            `${prefix}antibadword off\n` +

            `${prefix}antibadword add word1,word2\n` +

            `${prefix}antibadword del word1,word2\n` +

            `${prefix}antibadword list\n` +

            `${prefix}antibadword clear`,

        },

        { quoted: m }

      );

    }

    if (sub === "on") {

      g.enabled = true;

      writeConfig(cfg);

      return sock.sendMessage(from, { text: "✅ AntiBadword enabled for this group." }, { quoted: m });

    }

    if (sub === "off") {

      g.enabled = false;

      writeConfig(cfg);

      return sock.sendMessage(from, { text: "✅ AntiBadword disabled for this group." }, { quoted: m });

    }

    if (sub === "list") {

      const list = Array.isArray(g.words) ? g.words : [];

      return sock.sendMessage(

        from,

        { text: list.length ? `🧾 Badwords:\n- ${list.join("\n- ")}` : "No badwords set for this group." },

        { quoted: m }

      );

    }

    if (sub === "clear") {

      g.words = [];

      writeConfig(cfg);

      return sock.sendMessage(from, { text: "✅ Badword list cleared for this group." }, { quoted: m });

    }

    if (sub === "add") {

      const raw = args.slice(1).join(" ");

      const add = splitWords(raw);

      if (!add.length) {

        return sock.sendMessage(

          from,

          { text: `Usage: ${prefix}antibadword add word1,word2` },

          { quoted: m }

        );

      }

      const current = Array.isArray(g.words) ? g.words.map((w) => String(w).toLowerCase()) : [];

      const merged = [...new Set([...current, ...add])].slice(0, 500);

      g.words = merged;

      writeConfig(cfg);

      return sock.sendMessage(from, { text: `✅ Added. Total words: ${g.words.length}` }, { quoted: m });

    }

    if (sub === "del") {

      const raw = args.slice(1).join(" ");

      const del = splitWords(raw);

      if (!del.length) {

        return sock.sendMessage(

          from,

          { text: `Usage: ${prefix}antibadword del word1,word2` },

          { quoted: m }

        );

      }

      const current = Array.isArray(g.words) ? g.words.map((w) => String(w).toLowerCase()) : [];

      g.words = current.filter((w) => !del.includes(w));

      writeConfig(cfg);

      return sock.sendMessage(from, { text: `✅ Removed. Total words: ${g.words.length}` }, { quoted: m });

    }

    return sock.sendMessage(

      from,

      { text: `❌ Usage: ${prefix}antibadword on|off|add|del|list|clear|status` },

      { quoted: m }

    );

  },

};