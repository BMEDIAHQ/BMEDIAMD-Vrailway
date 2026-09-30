// commands/setrules.js (ESM)

// Owner-only (same owner check as antilink: isOwner(m, sock))

// Saves group rules text to control/config.json (group-specific)

//

// Usage:

//   <prefix>setrules <rules text>

//   <prefix>setrules reset

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

  name: "setrules",

  aliases: ["ruleset", "addrules"],

  category: "GROUP",

  description: "Set group rules (Owner only).",

  async execute(ctx) {

    const { sock, m, from, args, prefix } = ctx;

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "This command works in groups only." }, { quoted: m });

    }

    // ✅ Owner only (same as AntiLink)

    const ok = await isOwner(m, sock);

    if (!ok) return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });

    const text = String(args?.join(" ") || "").trim();

    if (!text) {

      return sock.sendMessage(

        from,

        { text: `Usage: ${prefix}setrules <rules text>\nOr: ${prefix}setrules reset` },

        { quoted: m }

      );

    }

    const cfg = readConfig();

    cfg.groupRules = cfg.groupRules || {};

    if (text.toLowerCase() === "reset") {

      delete cfg.groupRules[from];

      writeConfig(cfg);

      return sock.sendMessage(from, { text: "✅ Group rules cleared." }, { quoted: m });

    }

    cfg.groupRules[from] = {

      text,

      updatedAt: Date.now(),

    };

    writeConfig(cfg);

    return sock.sendMessage(from, { text: "✅ Group rules saved." }, { quoted: m });

  },

};