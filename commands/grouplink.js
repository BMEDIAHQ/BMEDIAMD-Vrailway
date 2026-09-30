// commands/grouplink.js

import { isOwner } from "../checks/isOwner.js";

function normalizeGroupJid(input = "") {

  const s = String(input || "").trim();

  if (!s) return "";

  if (s.endsWith("@g.us")) return s;

  return "";

}

export default {

  name: "grouplink",

  aliases: ["gidlink", "gcl", "gclink"],

  category: "GROUP",

  description: "Get a group invite link from a group jid or from the current group.",

  usage: "grouplink [groupjid]",

  async execute(ctx) {

    const { sock, m, from, args = [] } = ctx;

    if (!isOwner(m, sock)) {

      return sock.sendMessage(

        from,

        { text: "❌ Owner only." },

        { quoted: m }

      );

    }

    const input = String(args[0] || "").trim();

    const gid = normalizeGroupJid(input) || (from?.endsWith("@g.us") ? from : "");

    if (!gid) {

      return sock.sendMessage(

        from,

        {

          text:

            "❌ Provide a valid group jid or use this command inside a group.\n\n" +

            "Example:\n" +

            "grouplink 1203630xxxxxxx@g.us",

        },

        { quoted: m }

      );

    }

    try {

      const code = await sock.groupInviteCode(gid);

      if (!code) {

        return sock.sendMessage(

          from,

          { text: "❌ Could not fetch group invite code." },

          { quoted: m }

        );

      }

      const link = `https://chat.whatsapp.com/${code}`;

      return sock.sendMessage(

        from,

        {

          text:

            `🔗 *Group Link*\n\n` +

            `📌 GID: ${gid}\n` +

            `${link}`,

        },

        { quoted: m }

      );

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ Failed to get group link.\n${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};