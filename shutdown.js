// commands/shutdown.js (ESM)
// Owner-only shutdown (JID-based)
// Usage: !shutdown

import { isOwner } from "../checks/isOwner.js";

export default {
  name: "shutdown",
  aliases: ["stop", "poweroff"],
  category: "POWER",
  description: "Owner-only: stop the bot.",

  async execute(ctx) {
    const { sock, m, from } = ctx;

    const ok = await isOwner(m, sock);
    if (!ok) {
      return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });
    }

    try {
      await sock.sendMessage(from, { text: "🛑 Shutting down..." }, { quoted: m });
    } catch {}

    try { await sock.ws?.close?.(); } catch {}
    try { await sock.end?.(); } catch {}

    setTimeout(() => process.exit(0), 800);
  },
};
