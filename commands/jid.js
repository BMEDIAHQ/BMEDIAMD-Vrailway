// commands/myjid.js (ESM)

// Usage: !myjid

export default {

  name: "jid",

  aliases: ["myjid"],

  category: "TOOLS",

  description: "Show your WhatsApp JID (your account id).",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    const raw =

      sock?.user?.id ||

      sock?.user?.jid ||

      "Unknown";

    // ✅ converts: 237689660487:75@s.whatsapp.net -> 237689660487@s.whatsapp.net

    const jid = raw === "Unknown"

      ? raw

      : raw.replace(/^([^:]+)(?::\d+)?(@.+)$/, "$1$2");

    return sock.sendMessage(from, { text: `✅ *YOUR JID:*\n${jid}` }, { quoted: m });

  },

};