// commands/lid.js (ESM)
// Kept for compatibility: shows your WhatsApp JID (device id stripped).
// Usage: !lid

import { normalizeJid } from "../utils/jid.js";

export default {
  name: "lid",
  aliases: ["mylid", "myjid", "jid"],
  category: "TOOLS",
  description: "Show your WhatsApp JID (without device id).",

  async execute(ctx) {
    const { sock, m, from } = ctx;

    const raw = sock?.user?.id || sock?.user?.jid || "";
    const cleaned = normalizeJid(raw) || "Unknown";

    return sock.sendMessage(from, { text: `✅ *YOUR JID:*\n${cleaned}` }, { quoted: m });
  },
};
