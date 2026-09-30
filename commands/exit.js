// commands/exit.js

import { isOwner } from "../checks/isOwner.js";

export default {

  name: "exitgc",

  aliases: ["leavegc"],

  category: "OWNER",

  description: "Make the bot leave the current group.",

  usage: "exit",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    if (!isOwner(m, sock)) {

      return sock.sendMessage(

        from,

        { text: "❌ Owner only." },

        { quoted: m }

      );

    }

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(

        from,

        { text: "❌ This command works only in groups." },

        { quoted: m }

      );

    }

    try {

      await sock.sendMessage(

        from,

        { text: "👋 Leaving group..." },

        { quoted: m }

      );

      await sock.groupLeave(from);

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ Failed to leave group.\n${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};