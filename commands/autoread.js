// commands/autoread.js (ESM)

// ✅ Owner-only controller (same owner check as your antilink command: isOwner(m, sock))

// Toggles auto-read for chats (NOT statuses).

//

// Commands:

//   autoread on

//   autoread off

//   autoread status

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

export default {

  name: "autoread",

  aliases: ["readmode", "autoseen"],

  category: "OWNER",

  description: "Auto-read chats (Owner only).",

  async execute(ctx) {

    const { sock, m, from, args, prefix } = ctx;

    // ✅ OWNER ONLY

    const ok = await isOwner(m, sock);

    if (!ok) return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });

    const sub = String(args?.[0] || "").toLowerCase();

    const cfg = readConfig();

    cfg.autoRead = cfg.autoRead || { enabled: false };

    if (!sub || sub === "status") {

      return sock.sendMessage(

        from,

        {

          text:

            `👁️ AutoRead\n` +

            `• Enabled: ${cfg.autoRead.enabled ? "ON ✅" : "OFF ❌"}\n\n` +

            `Commands:\n` +

            `${prefix}autoread on\n` +

            `${prefix}autoread off`,

        },

        { quoted: m }

      );

    }

    if (sub === "on") {

      cfg.autoRead.enabled = true;

      writeConfig(cfg);

      return sock.sendMessage(from, { text: "✅ AutoRead enabled (chats only)." }, { quoted: m });

    }

    if (sub === "off") {

      cfg.autoRead.enabled = false;

      writeConfig(cfg);

      return sock.sendMessage(from, { text: "✅ AutoRead disabled." }, { quoted: m });

    }

    return sock.sendMessage(

      from,

      { text: `❌ Usage: ${prefix}autoread on|off|status` },

      { quoted: m }

    );

  },

};