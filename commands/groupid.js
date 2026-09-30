// commands/groupid.js (ESM)

// Usage: !groupid  (run inside a group)

export default {

  name: "groupid",

  aliases: ["gid"],

  category: "TOOLS",

  description: "Show the current group chat ID (run inside a group).",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    const isGroup = typeof from === "string" && from.endsWith("@g.us");

    if (!isGroup) {

      return sock.sendMessage(

        from,

        { text: "⚠️ This command only works in a group. Use it inside a group chat." },

        { quoted: m }

      );

    }

    return sock.sendMessage(from, { text: `✅ *GROUP ID:*\n${from}` }, { quoted: m });

  },

};