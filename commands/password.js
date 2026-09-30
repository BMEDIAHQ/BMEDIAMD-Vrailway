
// commands/password.js (ESM)
// password [length]
import crypto from "crypto";
export default {
  name: "password",
  aliases: ["genpass"],
  category: "TOOLS",
  description: "Generate strong password.",
  async execute(ctx) {
    const { sock, m, from, args=[] } = ctx;
    const len = Math.max(8, Math.min(64, Number(args[0] || 16)));
    const raw = crypto.randomBytes(len).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, len);
    return sock.sendMessage(from, { text: `🔑 ${raw}` }, { quoted: m });
  },
};
