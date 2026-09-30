// commands/antimentionall.js (ESM)

// Owner-only controls for AntiMentionAll (group-specific)

import { isOwner } from "../checks/isOwner.js";

import { getAntiMentionAllConfig, setAntiMentionAllConfig } from "../control/antiMentionAllHandler.js";

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender;

}

export default {

  name: "antimentionall",

  aliases: ["antitagall", "antihidetag", "mentionblock"],

  category: "OWNER",

  description: "Owner-only: delete messages that tag everyone (mass-mention).",

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

      const cfg = await getAntiMentionAllConfig(from);

      return sock.sendMessage(

        from,

        {

          text:

            `🛡️ *AntiMentionAll Settings*\n\n` +

            `• Status: ${cfg.enabled ? "✅ ON" : "❌ OFF"}\n` +

            `• Max mentions: ${cfg.maxMentions}\n\n` +

            `Commands:\n` +

            `• antimentionall on|off\n` +

            `• antimentionall max 8`,

        },

        { quoted: m }

      );

    }

    if (sub === "on") {

      await setAntiMentionAllConfig(from, { enabled: true });

      return sock.sendMessage(from, { text: "✅ AntiMentionAll enabled." }, { quoted: m });

    }

    if (sub === "off") {

      await setAntiMentionAllConfig(from, { enabled: false });

      return sock.sendMessage(from, { text: "✅ AntiMentionAll disabled." }, { quoted: m });

    }

    if (sub === "max") {

      const n = Number(args[1]);

      if (!Number.isFinite(n) || n < 5 || n > 200) {

        return sock.sendMessage(from, { text: "Usage: antimentionall max 8 (min 5)" }, { quoted: m });

      }

      await setAntiMentionAllConfig(from, { maxMentions: Math.floor(n) });

      return sock.sendMessage(from, { text: `✅ Max mentions set to ${Math.floor(n)}.` }, { quoted: m });

    }

    return sock.sendMessage(from, { text: "❌ Unknown option. Type: antimentionall" }, { quoted: m });

  },

};