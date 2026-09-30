// commands/tempmail.js (ESM)
// Creates a temp email and stores session in control/config.json (persistent).
// ✅ OWNER ONLY (NO SUDO) — uses checks/isOwner.js
//
// Usage: tempmail

import fs from "fs";
import path from "path";
import { isOwner } from "../checks/isOwner.js";

const CONFIG_PATH = path.resolve(process.cwd(), "control", "config.json");

function readJSONSafe(filePath) {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeJSONAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}

function saveSession(from, session) {
  const cfg = readJSONSafe(CONFIG_PATH);
  cfg.tempMailSessions ||= {};
  cfg.tempMailSessions[from] = session;

  // Keep file small (prune > 200 sessions)
  const keys = Object.keys(cfg.tempMailSessions);
  if (keys.length > 200) {
    keys
      .map((k) => ({ k, t: Number(cfg.tempMailSessions[k]?.created_at || 0) }))
      .sort((a, b) => a.t - b.t)
      .slice(0, keys.length - 200)
      .forEach(({ k }) => delete cfg.tempMailSessions[k]);
  }

  writeJSONAtomic(CONFIG_PATH, cfg);
}

export default {
  name: "tempmail",
  aliases: ["tmail", "tmpmail"],
  category: "UTILITY",
  description: "Create a temporary email address (saved to config).",
  async execute(ctx) {
    const { sock, m, from } = ctx;

    // Load control config once per call (small file)
    const ctrl = readJSONSafe(CONFIG_PATH);

    // OWNER ONLY (NO SUDO)
    if (!isOwner(m, sock, ctrl)) {
      return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m }).catch(() => {});
    }

    const API = "https://apis.davidcyril.name.ng/temp-mail";

    try {
      await sock.sendMessage(from, { react: { text: "📨", key: m.key } }).catch(() => {});

      const res = await fetch(API, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json().catch(() => null);
      if (!data?.success || !data?.email || !data?.session_id) {
        throw new Error(data?.message || "Invalid API response.");
      }

      const session = {
        email: data.email,
        session_id: data.session_id,
        expires_at: data.expires_at || null,
        created_at: Date.now(),
      };

      saveSession(from, session);

      const text =
        `✅ *Temp Mail Created*\n\n` +
        `📧 Email: *${session.email}*\n` +
        `🆔 Session ID: \`${session.session_id}\`\n` +
        `${session.expires_at ? `⏳ Expires: ${session.expires_at}\n\n` : "\n"}` +
        `Inbox: use *tempmailinbox* (or *tminbox*)\n` +
        `Or: *tminbox ${session.session_id}*`;

      await sock.sendMessage(from, { text }, { quoted: m });
      await sock.sendMessage(from, { react: { text: "✅", key: m.key } }).catch(() => {});
    } catch (e) {
      await sock.sendMessage(
        from,
        { text: `❌ Temp mail failed.\nReason: ${e?.message || "unknown error"}` },
        { quoted: m }
      ).catch(() => {});
    }
  },
};
