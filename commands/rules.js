// commands/rules.js (ESM)

// Displays saved group rules (group-specific)

// Usage: <prefix>rules

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

function fmtTime(ms) {

  try {

    return new Date(ms).toLocaleString();

  } catch {

    return "";

  }

}

export default {

  name: "rules",

  aliases: ["grouprules"],

  category: "GROUP",

  description: "Show group rules.",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "This command works in groups only." }, { quoted: m });

    }

    const cfg = readConfig();

    const entry = cfg?.groupRules?.[from];

    if (!entry?.text) {

      return sock.sendMessage(from, { text: "No rules set for this group." }, { quoted: m });

    }

    const when = entry.updatedAt ? `\n\nUpdated: ${fmtTime(entry.updatedAt)}` : "";

    return sock.sendMessage(

      from,

      { text: `📌 *Group Rules*\n\n${entry.text}${when}` },

      { quoted: m }

    );

  },

};