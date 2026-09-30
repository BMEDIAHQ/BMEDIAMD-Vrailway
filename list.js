// commands/list.js (ESM)

// Lists ALL commands by scanning ./commands (same style as menu.js)

// - No duplicates

// - Alphabetical order

// - Numbered

// - Command name is UPPERCASE + WhatsApp bold

// Format:

// 1. *COMMAND*

// *Aliases :* a, b

// description

//

// (blank line between commands)

import fs from "fs";

import path from "path";

import { pathToFileURL } from "url";

const COMMANDS_DIR = path.resolve(process.cwd(), "commands");

const bold = (s) => `*${s}*`;

function listCommandFiles() {

  if (!fs.existsSync(COMMANDS_DIR)) return [];

  return fs

    .readdirSync(COMMANDS_DIR)

    .filter((f) => f.endsWith(".js") && !f.startsWith("_"));

}

async function loadAllCommandsFromDisk() {

  const files = listCommandFiles();

  const items = [];

  for (const f of files) {

    const full = path.join(COMMANDS_DIR, f);

    const bust = fs.statSync(full).mtimeMs;

    const url = pathToFileURL(full).href + `?v=${bust}`;

    try {

      const mod = await import(url);

      const cmd = mod?.default;

      if (!cmd?.name || typeof cmd.execute !== "function") continue;

      items.push(cmd);

    } catch {

      // ignore broken command files silently

    }

  }

  // ✅ de-dupe by command name (case-insensitive)

  const seen = new Set();

  const uniq = [];

  for (const c of items) {

    const k = String(c.name).toLowerCase();

    if (seen.has(k)) continue;

    seen.add(k);

    uniq.push(c);

  }

  // ✅ alphabetical

  uniq.sort((a, b) => String(a.name).localeCompare(String(b.name)));

  return uniq;

}

function formatAliases(arr) {

  if (!Array.isArray(arr) || arr.length === 0) return "None";

  // de-dupe aliases too

  const uniq = [...new Set(arr.map((x) => String(x).trim()).filter(Boolean))];

  return uniq.length ? uniq.join(", ") : "None";

}

export default {

  name: "list",

  aliases: ["cmdlist", "commandslist"],

  category: "INFO",

  description: "List all commands and their descriptions (A–Z).",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    const cmds = await loadAllCommandsFromDisk();

    if (!cmds.length) {

      return sock.sendMessage(from, { text: "❌ No commands found in ./commands." }, { quoted: m });

    }

    const lines = [];

    let i = 1;

    for (const c of cmds) {

      const name = String(c.name || "").trim();

      const desc = String(c.description || "No description.").trim();

      const aliases = formatAliases(c.aliases);

      lines.push(`${i}. ${bold(name.toUpperCase())}`);

      lines.push(`${bold("ALIASES :")}`);

      lines.push(aliases);
        
 lines.push(`${bold("DESCRIPTION :")}`);

      lines.push(desc);

      lines.push(""); // blank line between commands

      i++;

    }

    const text = lines.join("\n").trimEnd();

    return sock.sendMessage(from, { text }, { quoted: m });

  },

};