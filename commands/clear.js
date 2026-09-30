// commands/clear.js

import { isOwner } from "../checks/isOwner.js";

function buildLastMessageCursor(m) {

  return {

    key: {

      remoteJid: m.key.remoteJid,

      id: m.key.id,

      fromMe: !!m.key.fromMe,

      ...(m.key.participant ? { participant: m.key.participant } : {}),

    },

    messageTimestamp: m.messageTimestamp,

  };

}

export default {

  name: "clear",

  aliases: ["clearchat"],

  category: "OWNER",

  description: "Clear the current chat.",

  usage: "clear",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    if (!isOwner(m, sock)) {

      return sock.sendMessage(

        from,

        { text: "❌ Owner only." },

        { quoted: m }

      );

    }

    try {

      await sock.chatModify(

        {

          clear: true,

          lastMessages: [buildLastMessageCursor(m)],

        },

        from

      );

      await sock.sendMessage(

        from,

        { text: "🧹 Chat cleared." },

        { quoted: m }

      ).catch(() => {});

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ Clear failed.\n${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};