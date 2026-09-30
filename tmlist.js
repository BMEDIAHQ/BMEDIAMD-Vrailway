// commands/tmlist.js (ESM)
// List temp-mail sessions stored in control/config.json.
// ✅ OWNER ONLY (NO SUDO) — uses checks/isOwner.js
//
// Usage:
//   tmlist              -> list up to 15 saved sessions
//   tmlist all          -> list all sessions (may be long)
//   tmlist <jid|id>     -> show one session by chat jid OR by session_id
//
// Notes:
// - Sessions are stored under cfg.tempMailSessions[fromJid]

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

function maskEmail(email) {
  const e = String(email || "");
  const at = e.indexOf("@");
  if (at <= 1) return e;
  const name = e.slice(0, at);
  const dom = e.slice(at);
  return name[0] + "****" + name.slice(-1) + dom;
}

export default {
  name: "tmlist",
  aliases: ["tmsessions", "tmls"],
  category: "UTILITY",
  description: "List saved temp mail sessions (owner-only).",
  async execute(ctx) {
    const { sock, m, from, args = [] } = ctx;

    const cfg = readJSONSafe(CONFIG_PATH);

    // OWNER ONLY
    if (!isOwner(m, sock, cfg)) {
      return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m }).catch(() => {});
    }

    const sessions = cfg?.tempMailSessions || {};
    const keys = Object.keys(sessions);

    if (!keys.length) {
      return sock.sendMessage(from, { text: "ℹ️ No temp mail sessions saved." }, { quoted: m }).catch(() => {});
    }

    const q = String(args[0] || "").trim();

    // Show a single session by chat JID or session_id
    if (q && q.toLowerCase() !== "all") {
      // direct chat jid key
      if (sessions[q]) {
        const s = sessions[q];
        const text =
          `📌 *Temp Mail Session*\n\n` +
          `Chat: \`${q}\`\n` +
          `Email: *${s.email || "-"}*\n` +
          `Session: \`${s.session_id || "-"}\`\n` +
          `Expires: ${s.expires_at || "-"}\n` +
          `Created: ${s.created_at ? new Date(s.created_at).toISOString() : "-"}`;
        return sock.sendMessage(from, { text }, { quoted: m }).catch(() => {});
      }

      // search by session_id
      const found = keys.find((jid) => sessions[jid]?.session_id === q);
      if (found) {
        const s = sessions[found];
        const text =
          `📌 *Temp Mail Session*\n\n` +
          `Chat: \`${found}\`\n` +
          `Email: *${s.email || "-"}*\n` +
          `Session: \`${s.session_id || "-"}\`\n` +
          `Expires: ${s.expires_at || "-"}\n` +
          `Created: ${s.created_at ? new Date(s.created_at).toISOString() : "-"}`;
        return sock.sendMessage(from, { text }, { quoted: m }).catch(() => {});
      }

      return sock.sendMessage(from, { text: `ℹ️ No session found for: ${q}` }, { quoted: m }).catch(() => {});
    }

    // Default list limit (avoid huge message)
    const showAll = q.toLowerCase() === "all";
    const limit = showAll ? keys.length : 15;

    // sort newest first
    const rows = keys
      .map((jid) => ({ jid, s: sessions[jid] }))
      .sort((a, b) => Number(b.s?.created_at || 0) - Number(a.s?.created_at || 0))
      .slice(0, limit);

    const lines = rows.map((x, i) => {
      const s = x.s || {};
      const email = showAll ? (s.email || "-") : maskEmail(s.email);
      const exp = s.expires_at || "-";
      const sid = s.session_id ? String(s.session_id).slice(0, 12) + "…" : "-";
      return (
        `${i + 1}) ${email}\n` +
        `   Chat: ${x.jid}\n` +
        `   ID: ${sid}\n` +
        `   Exp: ${exp}`
      );
    });

    const footer = showAll
      ? ""
      : `\n\nTip: use *tmlist all* to list everything, or *tmlist <session_id>* to view one.`;

    const text = `📬 *Temp Mail Sessions* (${keys.length})\n\n` + lines.join("\n\n") + footer;

    // If message is too long, truncate safely
    const safeText = text.length > 6000 ? text.slice(0, 6000) + "\n…(truncated)" : text;

    return sock.sendMessage(from, { text: safeText }, { quoted: m }).catch(() => {});
  },
};
