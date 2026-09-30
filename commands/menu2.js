import fs from "fs";
import path from "path";
import { pathToFileURL, fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve relative to this file (commands/menu.js) so it works regardless of process.cwd()
const PROJECT_ROOT = path.resolve(__dirname, "..");
const COMMANDS_DIR = path.join(PROJECT_ROOT, "commands");
const CONTROL_DIR = path.join(PROJECT_ROOT, "control");
const CONFIG_FILE = path.join(CONTROL_DIR, "config.json");

const bold = (s) => `*${s}*`;

function loadAllCommands() {
  const manifestFile = path.join(COMMANDS_DIR, "manifest.json");
  try {
    const raw = fs.readFileSync(manifestFile, "utf8");
    const manifest = JSON.parse(raw || "{}");
    return Object.entries(manifest).map(([name, info]) => ({
      name,
      category: String(info?.category || "MISC").toUpperCase(),
      aliases: Array.isArray(info?.aliases) ? info.aliases : [],
    }));
  } catch {
    return fs.readdirSync(COMMANDS_DIR)
      .filter((f) => f.endsWith(".js") && !f.startsWith("_"))
      .map((f) => ({ name: path.basename(f, ".js"), category: "MISC", aliases: [] }));
  }
}

async function getRuntimeMode() {
  // Prefer persisted mode from ./control/mode.js (reads ./control/state.json)
  try {
    const modeFile = path.join(CONTROL_DIR, "mode.js");
    if (fs.existsSync(modeFile)) {
      const bust = fs.statSync(modeFile).mtimeMs;
      const url = pathToFileURL(modeFile).href + `?v=${bust}`;
      const mod = await import(url);
      const getMode = mod?.getMode || mod?.default?.getMode;
      if (typeof getMode === "function") {
        const m = String(getMode() || "public").toLowerCase();
        return m === "private" ? "private" : "public";
      }
    }
  } catch {}
  const env = String(process.env.BOT_MODE || "public").toLowerCase();
  return env === "private" ? "private" : "public";
}

function getRuntimePrefix(ctx) {
  // Prefer persisted prefix from ./control/config.json; fallback to .env PREFIX
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
      const cfg = JSON.parse(raw || "{}");
      if (typeof cfg.prefix === "string") return cfg.prefix; // may be ""
    }
  } catch {}
  const p = process.env.PREFIX ?? ctx?.prefix ?? "!";
  return typeof p === "string" ? p : "!";
}

export default {
  name: "menu2",
  aliases: ["help2", "commands2"],
  category: "INFO",
  description: "Show available commands grouped by category.",

  async execute(ctx) {
    const { sock, m, from } = ctx;
    const t0 = Date.now();

    const BOT_NAME = (process.env.BOT_NAME || ctx.botName || "BOT").trim();

    const PREFIX = getRuntimePrefix(ctx);
    const PREFIX_DISPLAY = PREFIX === "" ? "NO PREFIX" : PREFIX;

    const AUTHOR = (process.env.AUTHOR || "Unknown").trim();
    const MODE = (await getRuntimeMode()).toUpperCase();

    const userName =
      (m?.pushName && String(m.pushName).trim()) ||
      (ctx.sender ? String(ctx.sender).split("@")[0] : "User");

    const cmds = await loadAllCommands();

    const groups = new Map();
    for (const c of cmds) {
      const cat = String(c.category || "MISC").toUpperCase();
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat).push(c);
    }

    const cats = [...groups.keys()].sort((a, b) => a.localeCompare(b));
    for (const cat of cats) {
      groups.get(cat).sort((a, b) => String(a.name).localeCompare(String(b.name)));
    }

    const speed = (Date.now() - t0).toFixed(2);

    const lines = [];
    lines.push("┌──────────────────");
    lines.push(`│ ${bold(BOT_NAME)} BOT MENU`);
    lines.push("└──────────────────");
    lines.push("");

    lines.push("┌──────────────────");
    lines.push(`│ ${bold("BOT INFORMATION:")}`);
    lines.push(`│ ${bold("USERS:")} ${userName}`);
    lines.push(`│ ${bold("MODE:")} ${MODE}`);
    lines.push(`│ ${bold("PREFIX:")} [ ${PREFIX_DISPLAY} ]`);
    lines.push(`│ ${bold("AUTHOR:")} ${bold(AUTHOR)}`);
    lines.push(`│ ${bold("SPEED:")} ${speed}ms`);
    lines.push(`│ ${bold("COMMANDS:")} ${cmds.length}`);
    lines.push("└──────────────────");

    for (const cat of cats) {
      lines.push("");
      lines.push("┌──────────────────");
      lines.push(`│ ${bold(`「 ${cat} 」`)}`);
      lines.push("├──────────────────");
      for (const c of groups.get(cat)) lines.push(`│ ✺ ${PREFIX}${c.name}`);
      lines.push("└──────────────────");
    }

    lines.push("");
    const CHANNEL_URL = (process.env.CHANNEL_URL || "").trim();
    lines.push("");
    lines.push(`> ${bold("POWERED BY BMEDIA")}`);
    lines.push("");
    if (CHANNEL_URL) lines.push(CHANNEL_URL);

    const caption = lines.join("\n");

    const logoPath = path.join(PROJECT_ROOT, "assets", "logo.png");
    if (fs.existsSync(logoPath)) {
      const buffer = fs.readFileSync(logoPath);
      return sock.sendMessage(from, { image: buffer, caption }, { quoted: m });
    }

    return sock.sendMessage(from, { text: caption }, { quoted: m });
  },
};
