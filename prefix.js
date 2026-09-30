// commands/prefix.js (ESM)
// Uses ctx.args (NOT raw message) to avoid the "! Prefix ..." bug.
// Stores prefix in control/config.json
//
// Correct behavior:
// - "! Prefix" => shows usage (no change)
// - "! Prefix null" => sets no prefix
// - "!prefix null" => sets no prefix

import fs from "fs";
import path from "path";
import { isOwner } from "../checks/isOwner.js";

const CONTROL_DIR = path.resolve(process.cwd(), "control");
const CONFIG_FILE = path.join(CONTROL_DIR, "config.json");

function readJsonSafe(file, fallback = {}) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, "utf-8");
    if (!raw?.trim()) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJsonSafe(file, obj) {
  try {
    if (!fs.existsSync(CONTROL_DIR)) fs.mkdirSync(CONTROL_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(obj, null, 2));
    return true;
  } catch {
    return false;
  }
}

function deleteFileSafe(file) {
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return true;
  } catch {
    return false;
  }
}

function normalizePrefixInput(input) {
  const t = String(input ?? "").trim();
  if (!t) return null;

  // Support explicit empty:
  if (t === '""' || t === "''") return "";

  const low = t.toLowerCase();
  if (["off", "none", "null", "noprefix", "no-prefix", "0"].includes(low)) return "";
  if (low === "reset") return "__RESET__";

  // Remove quotes if user wrapped the prefix
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }

  return t;
}

export default {
  name: "prefix",
  aliases: ["setprefix"],
  category: "OWNER",
  description: "Set bot prefix and save to control/config.json",

  async execute(ctx) {
    const { sock, m, from } = ctx;

    // Owner-only (same working pattern as tag.js)
    if (!isOwner(m, sock)) {
      return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });
    }

    // Use ctx.args (already parsed by index)
    let argText = (ctx.args || []).join(" ").trim();

    // Fix: if user typed "! Prefix ..." (space after prefix),
    // some setups end up passing args like ["Prefix", "null"] or argText "Prefix null".
    // If argText starts with "prefix", strip it once.
    if (/^prefix(\s+|$)/i.test(argText)) {
      argText = argText.replace(/^prefix(\s+)?/i, "").trim();
    }

    const cfg = readJsonSafe(CONFIG_FILE, {});
    const envDefault = (process.env.PREFIX ?? "!").toString();
    const current = typeof cfg?.prefix === "string" ? cfg.prefix : null;
    const effective = current !== null ? current : envDefault;

    // No args => show usage (and DO NOT change anything)
    if (!argText) {
      return sock.sendMessage(
        from,
        {
          text:
            `⚙️ Current prefix: ${effective === "" ? "(no prefix)" : `\`${effective}\``}\n\n` +
            `Use:\n` +
            `• ${effective === "" ? "prefix" : effective + "prefix"} <newPrefix>\n` +
            `• ${effective === "" ? "prefix" : effective + "prefix"} null   (no prefix)\n` +
            `• ${effective === "" ? "prefix" : effective + "prefix"} reset`,
        },
        { quoted: m }
      );
    }

    const wanted = normalizePrefixInput(argText);

    // If normalization says "no valid input", show usage
    if (wanted === null) {
      return sock.sendMessage(
        from,
        {
          text:
            `❌ Invalid usage.\n\n` +
            `To set no prefix use: ${effective === "" ? "prefix null" : effective + "prefix null"}`,
        },
        { quoted: m }
      );
    }

    if (wanted === "__RESET__") {
      const ok = deleteFileSafe(CONFIG_FILE);
      return sock.sendMessage(
        from,
        { text: ok ? `✅ Prefix reset. Using .env default: \`${envDefault}\`` : "❌ Failed to reset prefix." },
        { quoted: m }
      );
    }

    const next = {
      ...(typeof cfg === "object" && cfg ? cfg : {}),
      prefix: wanted, // "" means no prefix
      updatedAt: Date.now(),
    };

    const ok = writeJsonSafe(CONFIG_FILE, next);
    if (!ok) {
      return sock.sendMessage(from, { text: "❌ Failed to save prefix." }, { quoted: m });
    }

    return sock.sendMessage(
      from,
      { text: `✅ Prefix set to: ${wanted === "" ? "(no prefix)" : `\`${wanted}\``}` },
      { quoted: m }
    );
  },
};
