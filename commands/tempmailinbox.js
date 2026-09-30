// commands/tempmailinbox.js (ESM)
// Fetches inbox for a temp mail session stored in control/config.json.
// ✅ OWNER ONLY (NO SUDO) — uses checks/isOwner.js
//
// Usage:
//   tempmailinbox
//   tempmailinbox <session_id>

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

function getSavedSession(from) {
  const cfg = readJSONSafe(CONFIG_PATH);
  return cfg?.tempMailSessions?.[from] || null;
}

export default {
  name: "tempmailinbox",
  aliases: ["tminbox", "mailinbox"],
  category: "UTILITY",
  description: "Fetch inbox for a temp mail session (reads config).",
  async execute(ctx) {
    const { sock, m, from, args = [] } = ctx;

    const ctrl = readJSONSafe(CONFIG_PATH);

    // OWNER ONLY (NO SUDO)
    if (!isOwner(m, sock, ctrl)) {
      return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m }).catch(() => {});
    }

    const BASE = "https://apis.davidcyril.name.ng/temp-mail/inbox?id=";

    try {
      const idArg = String(args[0] || "").trim();
      const saved = getSavedSession(from);
      const sessionId = idArg || saved?.session_id;

      if (!sessionId) {
        return sock.sendMessage(
          from,
          {
            text:
              `❌ No session id found.\n\n` +
              `First create one: *tempmail*\n` +
              `Or use: *tminbox <session_id>*`,
          },
          { quoted: m }
        ).catch(() => {});
      }

      await sock.sendMessage(from, { react: { text: "📬", key: m.key } }).catch(() => {});

      const url = BASE + encodeURIComponent(sessionId);
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json().catch(() => null);
      if (!data) throw new Error("Invalid API response.");
      if (data.success === false) throw new Error(data.message || "Invalid session or empty inbox.");

      const inbox = data.inbox || data.messages || data.result || data.data || [];

      if (!Array.isArray(inbox) || inbox.length === 0) {
        const extra = saved?.email ? `\n📧 Email: *${saved.email}*` : "";
        return sock.sendMessage(
          from,
          { text: `✅ Inbox is empty.${extra}\n🆔 Session: \`${sessionId}\`` },
          { quoted: m }
        ).catch(() => {});
      }

      const max = 10;
      const lines = inbox.slice(0, max).map((msg, i) => {
        const fromX = msg.from || msg.sender || msg.mail_from || "unknown";
        const sub = msg.subject || msg.title || "(no subject)";
        const date = msg.date || msg.created_at || msg.time || "";
        const id = msg.id || msg.message_id || "";
        return `${i + 1}) *${sub}*\n   From: ${fromX}\n   Date: ${date}\n   ID: ${id}`.trim();
      });

      const header =
        `📬 *Temp Mail Inbox* (${inbox.length} message${inbox.length === 1 ? "" : "s"})\n` +
        `🆔 Session: \`${sessionId}\`\n` +
        (saved?.email ? `📧 Email: *${saved.email}*\n` : "");

      await sock.sendMessage(from, { text: header + "\n\n" + lines.join("\n\n") }, { quoted: m });
      await sock.sendMessage(from, { react: { text: "✅", key: m.key } }).catch(() => {});
    } catch (e) {
      await sock.sendMessage(
        from,
        { text: `❌ Inbox fetch failed.\nReason: ${e?.message || "unknown error"}` },
        { quoted: m }
      ).catch(() => {});
    }
  },
};
