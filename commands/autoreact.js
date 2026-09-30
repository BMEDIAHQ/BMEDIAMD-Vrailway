// commands/autoreact.js (ESM)

// ✅ Added OWNER-ONLY check (same method as AntiLink): isOwner(m, sock)

// ❗ Nothing else changed.

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

function parseEmojiList(raw) {

  return String(raw || "")

    .split(/[,\n]+/)

    .map((x) => x.trim())

    .filter(Boolean);

}

export default {

  name: "autoreact",

  aliases: ["areact", "reactmode"],

  category: "GROUP",

  description: "Auto-react to messages in a group (group-specific).",

  async execute(ctx) {

    const { sock, m, from, args, prefix } = ctx;

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "This command works in groups only." }, { quoted: m });

    }

    // ✅ OWNER ONLY (same as AntiLink command)

    const ok = await isOwner(m, sock);

    if (!ok) return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });

    const sub = String(args?.[0] || "").toLowerCase();

    const cfg = readConfig();

    cfg.autoReactGroups = cfg.autoReactGroups || {};

    cfg.autoReactGroups[from] = cfg.autoReactGroups[from] || { enabled: false, emojis: [] };

    const g = cfg.autoReactGroups[from];

    const envList =

      parseEmojiList(process.env.AUTOREACT_EMOJIS) ||

      parseEmojiList(process.env.REACT_EMOJIS) ||

      [];

    if (!sub || sub === "status") {

      const using = (Array.isArray(g.emojis) && g.emojis.length) ? "Group emojis" : "ENV emojis";

      const list = (Array.isArray(g.emojis) && g.emojis.length ? g.emojis : envList).join(" ");

      return sock.sendMessage(

        from,

        {

          text:

            `🤖 AutoReact (This Group)\n` +

            `• Enabled: ${g.enabled ? "ON ✅" : "OFF ❌"}\n` +

            `• Emoji source: ${using}\n` +

            `• Emojis: ${list || "N/A"}\n\n` +

            `Commands:\n` +

            `${prefix}autoreact on\n` +

            `${prefix}autoreact off\n` +

            `${prefix}autoreact set 😀,😁,😂\n` +

            `${prefix}autoreact set default`,

        },

        { quoted: m }

      );

    }

    if (sub === "on") {

      g.enabled = true;

      writeConfig(cfg);

      return sock.sendMessage(from, { text: "✅ AutoReact enabled for this group." }, { quoted: m });

    }

    if (sub === "off") {

      g.enabled = false;

      writeConfig(cfg);

      return sock.sendMessage(from, { text: "✅ AutoReact disabled for this group." }, { quoted: m });

    }

    if (sub === "set") {

      const raw = String(args.slice(1).join(" ") || "").trim();

      if (!raw) {

        return sock.sendMessage(

          from,

          { text: `Usage: ${prefix}autoreact set 😀,😁,😂  OR  ${prefix}autoreact set default` },

          { quoted: m }

        );

      }

      if (raw.toLowerCase() === "default") {

        g.emojis = [];

        writeConfig(cfg);

        return sock.sendMessage(

          from,

          { text: "✅ AutoReact emojis reset to ENV default for this group." },

          { quoted: m }

        );

      }

      const list = parseEmojiList(raw);

      if (!list.length) {

        return sock.sendMessage(from, { text: "❌ No valid emojis found. Example: 😀,😁,😂" }, { quoted: m });

      }

      g.emojis = list.slice(0, 50); // safety cap

      writeConfig(cfg);

      return sock.sendMessage(

        from,

        { text: `✅ AutoReact emojis updated:\n${g.emojis.join(" ")}` },

        { quoted: m }

      );

    }

    return sock.sendMessage(

      from,

      { text: `❌ Usage: ${prefix}autoreact on | off | set <emojis> | set default | status` },

      { quoted: m }

    );

  },

};