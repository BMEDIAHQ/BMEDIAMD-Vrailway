// commands/atasa.js (ESM)

// OWNER ONLY

// Toggle ATASA chatbot per-chat

// Usage: <prefix>atasa on | off | status

import { isAtasaEnabled, setAtasaEnabled } from "../control/atasaHandler.js";

import { isOwner } from "../checks/isOwner.js"; // ✅ your real owner check

export default {

  name: "atasa",

  aliases: ["chatbot"],

  category: "AI",

  description: "Toggle ATASA auto-reply per chat (on/off/status). (Owner only)",

  async execute(ctx) {

    const { sock, m, from, args } = ctx;

    // ✅ OWNER ONLY (same method your checks file is built for)

    if (!isOwner(m, sock)) {

      return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });

    }

    const sub = String(args?.[0] || "").toLowerCase();

    if (!sub || !["on", "off", "status"].includes(sub)) {

      return sock.sendMessage(

        from,

        { text: "Use:\n• atasa on\n• atasa off\n• atasa status" },

        { quoted: m }

      );

    }

    if (sub === "status") {

      return sock.sendMessage(

        from,

        { text: `ATASA is ${isAtasaEnabled(from) ? "✅ ON" : "❌ OFF"} in this chat.` },

        { quoted: m }

      );

    }

    setAtasaEnabled(from, sub === "on");

    return sock.sendMessage(

      from,

      { text: `ATASA auto-reply ${sub === "on" ? "✅ ON" : "❌ OFF"} for this chat.` },

      { quoted: m }

    );

  },

};