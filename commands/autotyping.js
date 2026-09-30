// commands/autotyping.js (ESM)

// Owner-only controller (same owner check as antilink: isOwner(m, sock))

// Toggles auto-typing presence.

//

// Commands:

//   autotyping on

//   autotyping off

//   autotyping status

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

  name: "autotyping",

  aliases: ["typingmode", "autotype"],

  category: "OWNER",

  description: "Auto typing presence (Owner only).",

  async execute(ctx) {

    const { sock, m, from, args, prefix } = ctx;

    // ✅ Owner only

    const ok = await isOwner(m, sock);

    if (!ok) return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });

    const sub = String(args?.[0] || "").toLowerCase();

    const cfg = readConfig();

    cfg.autoTyping = cfg.autoTyping || { enabled: false };

    if (!sub || sub === "status") {

      return sock.sendMessage(

        from,

        {

          text:

            `⌨️ AutoTyping\n` +

            `• Enabled: ${cfg.autoTyping.enabled ? "ON ✅" : "OFF ❌"}\n\n` +

            `Commands:\n` +

            `${prefix}autotyping on\n` +

            `${prefix}autotyping off`,

        },

        { quoted: m }

      );

    }

    if (sub === "on") {

      cfg.autoTyping.enabled = true;

      writeConfig(cfg);

      return sock.sendMessage(from, { text: "✅ AutoTyping enabled." }, { quoted: m });

    }

    if (sub === "off") {

      cfg.autoTyping.enabled = false;

      writeConfig(cfg);

      return sock.sendMessage(from, { text: "✅ AutoTyping disabled." }, { quoted: m });

    }

    return sock.sendMessage(

      from,

      { text: `❌ Usage: ${prefix}autotyping on|off|status` },

      { quoted: m }

    );

  },

};