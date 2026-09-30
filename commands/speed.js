// commands/speed.js (ESM)
// Ping + tb6 buttons via helper in assets folder.

import { sendWebsiteButtons } from "../assets/websiteButtons.js";

export default {
  name: "speed",
  aliases: ["vitesse"],
  category: "INFO",
  description: "Check bot responsiveness.",

  async execute(ctx) {
    const { sock, m, from } = ctx;

    try {
      const t0 = Date.now();
      const msg = await sock.sendMessage(from, { text: "Pinging…" }, { quoted: m });
      const ms = Date.now() - t0;

      await sock.sendMessage(from, { text: `Pong! Response time: ${ms}ms` }, { quoted: msg });

      // ✅ send native flow buttons (exact tb6) from helper
      await sendWebsiteButtons(sock, m, from);

      await sock.sendMessage(from, { react: { text: "✅", key: m.key } }).catch(() => {});
    } catch (e) {
      await sock
        .sendMessage(
          from,
          { text: `❌ ping failed\nReason: ${e?.message || e}` },
          { quoted: m }
        )
        .catch(() => {});
    }
  },
};
