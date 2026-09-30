// commands/antibot.js (ESM)

// Owner-only AntiBot controls (group-specific)

import { isOwner } from "../checks/isOwner.js";

import { getAntiBotConfig, setAntiBotConfig } from "../control/antiBotHandler.js";

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender;

}

export default {

  name: "antibot",

  aliases: ["abot"],

  category: "OWNER",

  description: "Owner-only: Auto-kick other bots (non-admin).",

  async execute(ctx) {

    const { sock, m, from, args = [] } = ctx;

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "This command works in groups only." }, { quoted: m });

    }

    const sender = getSender(m);

    if (!sender) return;

    if (!isOwner(m, sock)) {

      const tag = `@${sender.split("@")[0].split(":")[0]}`;

      return sock.sendMessage(from, { text: `❌ Owner only.\n\n${tag}`, mentions: [sender] }, { quoted: m });

    }

    const sub = String(args[0] || "").toLowerCase();

    if (!sub) {

      const cfg = await getAntiBotConfig(from);

      return sock.sendMessage(

        from,

        { text: `🤖 *AntiBot*\n\n• Status: ${cfg.enabled ? "✅ ON" : "❌ OFF"}\n\nUse:\n• antibot on\n• antibot off` },

        { quoted: m }

      );

    }

    if (sub === "on") {

      await setAntiBotConfig(from, { enabled: true });

      return sock.sendMessage(from, { text: "✅ AntiBot enabled." }, { quoted: m });

    }

    if (sub === "off") {

      await setAntiBotConfig(from, { enabled: false });

      return sock.sendMessage(from, { text: "✅ AntiBot disabled." }, { quoted: m });

    }

    return sock.sendMessage(from, { text: "❌ Unknown option. Use: antibot on|off" }, { quoted: m });

  },

};