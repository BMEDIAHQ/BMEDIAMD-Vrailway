// commands/tmdelete.js (ESM)
// Delete temp-mail sessions stored in control/config.json.
// ✅ OWNER ONLY (NO SUDO) — uses checks/isOwner.js
//
// Usage:
//   tmdelete                -> delete saved session for this chat (from)
//   tmdelete <session_id>   -> delete a specific session by session_id (or pass a chat JID)
//   tmdelete all            -> delete ALL saved sessions
//   tmdelete expired        -> delete sessions whose expires_at has passed

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

function parseExpiry(expires_at) {
  if (!expires_at) return null;
  const t = Date.parse(expires_at);
  return Number.isFinite(t) ? t : null;
}

export default {
  name: "tmdelete",
  aliases: ["tmdel"],
  category: "UTILITY",
  description: "Delete temp mail sessions (all / expired / by id).",
  async execute(ctx) {
    const { sock, m, from, args = [] } = ctx;

    const ctrl = readJSONSafe(CONFIG_PATH);

    // OWNER ONLY (NO SUDO)
    if (!isOwner(m, sock, ctrl)) {
      return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m }).catch(() => {});
    }

    const mode = String(args[0] || "").trim().toLowerCase();

    const cfg = ctrl;
    cfg.tempMailSessions ||= {};

    const beforeCount = Object.keys(cfg.tempMailSessions).length;

    // default: delete current chat session
    if (!mode) {
      if (cfg.tempMailSessions[from]) {
        delete cfg.tempMailSessions[from];
        writeJSONAtomic(CONFIG_PATH, cfg);
        return sock
          .sendMessage(from, { text: "✅ Deleted temp mail session for this chat." }, { quoted: m })
          .catch(() => {});
      }
      return sock
        .sendMessage(from, { text: "ℹ️ No saved temp mail session for this chat." }, { quoted: m })
        .catch(() => {});
    }

    if (mode === "all") {
      cfg.tempMailSessions = {};
      writeJSONAtomic(CONFIG_PATH, cfg);
      return sock
        .sendMessage(from, { text: `✅ Deleted all temp mail sessions (${beforeCount}).` }, { quoted: m })
        .catch(() => {});
    }

    if (mode === "expired") {
      const now = Date.now();
      let removed = 0;

      for (const [jid, sess] of Object.entries(cfg.tempMailSessions)) {
        const exp = parseExpiry(sess?.expires_at);
        if (exp !== null && exp <= now) {
          delete cfg.tempMailSessions[jid];
          removed++;
        }
      }

      writeJSONAtomic(CONFIG_PATH, cfg);
      return sock
        .sendMessage(
          from,
          { text: removed ? `✅ Deleted ${removed} expired session(s).` : "ℹ️ No expired sessions found." },
          { quoted: m }
        )
        .catch(() => {});
    }

    // tmdelete <session_id> (or a chat jid)
    const target = String(args[0]).trim();
    let removed = 0;

    if (cfg.tempMailSessions[target]) {
      delete cfg.tempMailSessions[target];
      removed++;
    } else {
      for (const [jid, sess] of Object.entries(cfg.tempMailSessions)) {
        if (sess?.session_id === target) {
          delete cfg.tempMailSessions[jid];
          removed++;
        }
      }
    }

    if (removed) {
      writeJSONAtomic(CONFIG_PATH, cfg);
      return sock
        .sendMessage(from, { text: `✅ Deleted ${removed} session(s) for: ${target}` }, { quoted: m })
        .catch(() => {});
    }

    return sock
      .sendMessage(from, { text: `ℹ️ No session found for: ${target}` }, { quoted: m })
      .catch(() => {});
  },
};
