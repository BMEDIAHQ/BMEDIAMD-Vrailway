// commands/antilink.js (ESM)

// Commands (exact as you asked):

// antilink on

// antilink delete

// antilink warn

// antilink kick

// antilink warnlimit <number>

// antilink off (optional)

// antilink status (optional)

//

// Stores per-group settings in control/config.json:

// cfg.antiLinkGroups[groupJid] = { enabled, mode, warnLimit }

import fs from "fs";

import path from "path";

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

function ensureGroupCfg(cfg, groupJid) {

  cfg.antiLinkGroups = cfg.antiLinkGroups || {};

  cfg.antiLinkGroups[groupJid] = cfg.antiLinkGroups[groupJid] || {};

  const g = cfg.antiLinkGroups[groupJid];

  if (typeof g.enabled !== "boolean") g.enabled = false;

  if (!["delete", "warn", "kick"].includes(g.mode)) g.mode = "delete";

  if (!Number.isInteger(g.warnLimit) || g.warnLimit < 1) g.warnLimit = 3;

  return g;

}

export default {

  name: "antilink",

  aliases: ["anti-link", "antilinks"],

  category: "GROUP",

  description: "AntiLink group controls (on/delete/warn/kick/warnlimit).",

  async execute(ctx) {

    const { sock, m, from, args } = ctx;

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "This command works in groups only." }, { quoted: m });

    }

    // Sender for mention (optional)

    const sender = m?.key?.participant || m?.participant || m?.sender;

    // Admin check EXACT same method as your working example

    const bare = (id) => String(id || "").split("@")[0].split(":")[0];

    let isAdmin = false;

    try {

      const meta = await sock.groupMetadata(from);

      const senderBare = bare(sender);

      const me = (meta.participants || []).find((p) => bare(p.id) === senderBare);

      isAdmin = Boolean(me?.admin);

    } catch {

      isAdmin = false;

    }

    if (!isAdmin) {

      return sock.sendMessage(from, { text: "❌ Admin only." }, { quoted: m });

    }

    const sub = String(args?.[0] || "").toLowerCase();

    const cfg = readConfig();

    const g = ensureGroupCfg(cfg, from);

    if (!sub || sub === "status") {

      return sock.sendMessage(

        from,

        {

          text:

            `🛡️ AntiLink (This Group)\n` +

            `• Enabled: ${g.enabled ? "ON" : "OFF"}\n` +

            `• Mode: ${g.mode}\n` +

            `• Warn limit: ${g.warnLimit}\n\n` +

            `Commands:\n` +

            `antilink on\n` +

            `antilink delete\n` +

            `antilink warn\n` +

            `antilink kick\n` +

            `antilink warnlimit 3\n` +

            `antilink off`,

        },

        { quoted: m }

      );

    }

    if (sub === "on") {

      g.enabled = true;

      if (!["delete", "warn", "kick"].includes(g.mode)) g.mode = "delete";

      writeConfig(cfg);

      return sock.sendMessage(from, { text: `✅ AntiLink enabled (mode: ${g.mode}).` }, { quoted: m });

    }

    if (sub === "off") {

      g.enabled = false;

      writeConfig(cfg);

      return sock.sendMessage(from, { text: "✅ AntiLink disabled." }, { quoted: m });

    }

    if (sub === "delete") {

      g.enabled = true;

      g.mode = "delete";

      writeConfig(cfg);

      return sock.sendMessage(from, { text: "✅ AntiLink set to: DELETE" }, { quoted: m });

    }

    if (sub === "warn") {

      g.enabled = true;

      g.mode = "warn";

      writeConfig(cfg);

      return sock.sendMessage(

        from,

        { text: `✅ AntiLink set to: WARN\nWill kick after ${g.warnLimit} warnings.` },

        { quoted: m }

      );

    }

    if (sub === "kick") {

      g.enabled = true;

      g.mode = "kick";

      writeConfig(cfg);

      return sock.sendMessage(from, { text: "✅ AntiLink set to: KICK" }, { quoted: m });

    }

    if (sub === "warnlimit") {

      const n = parseInt(args?.[1], 10);

      if (!Number.isFinite(n) || n < 1 || n > 20) {

        return sock.sendMessage(from, { text: "❌ Usage: antilink warnlimit <1-20>" }, { quoted: m });

      }

      g.warnLimit = n;

      writeConfig(cfg);

      return sock.sendMessage(from, { text: `✅ Warn limit set to: ${n}` }, { quoted: m });

    }

    return sock.sendMessage(

      from,

      { text: "❌ Usage: antilink on | delete | warn | kick | warnlimit <n> | off" },

      { quoted: m }

    );

  },

};