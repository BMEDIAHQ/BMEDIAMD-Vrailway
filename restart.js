// commands/restart.js

import { isOwner } from "../checks/isOwner.js";

import path from "path";

const ROOT = process.cwd();

async function restartBot(entry = "index.js") {

  const entryAbs = path.join(ROOT, entry);

  if (typeof process.execve !== "function") {

    throw new Error(

      "This Node.js version does not support process.execve()."

    );

  }

  await new Promise((resolve) => setTimeout(resolve, 700));

  // Replace current process in-place

  process.execve(process.execPath, [process.execPath, entryAbs], process.env);

}

export default {

  name: "restart",

  aliases: ["reboot", "reload"],

  category: "OWNER",

  description: "Restart the bot.",

  usage: "restart",

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

      await sock.sendMessage(

        from,

        { text: "♻️ Restarting bot..." },

        { quoted: m }

      );

      await restartBot(process.env.REPO_ENTRY || "index.js");

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ Restart failed.\n${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};