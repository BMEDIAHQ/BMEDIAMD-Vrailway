// commands/antiflood.js (ESM)

// Owner-only AntiFlood controls (group-specific)

import { isOwner } from "../checks/isOwner.js";

import { getAntiFloodConfig, setAntiFloodConfig } from "../control/antiFloodHandler.js";

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender;

}

export default {

  name: "antiflood",

  aliases: ["aflood"],

  category: "OWNER",

  description: "Owner-only: AntiFlood (too many messages in X seconds).",

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

      const cfg = await getAntiFloodConfig(from);

      return sock.sendMessage(

        from,

        {

          text:

            `🌊 *AntiFlood Settings*\n\n` +

            `• Status: ${cfg.enabled ? "✅ ON" : "❌ OFF"}\n` +

            `• Limit: ${cfg.maxMsgs} msgs / ${cfg.windowSec}s\n` +

            `• Warn limit: ${cfg.warnLimit}\n\n` +

            `Commands:\n` +

            `• antiflood on|off\n` +

            `• antiflood set <seconds> <maxMsgs>\n` +

            `• antiflood warnlimit <number>\n` +

            `• antiflood reset`,

        },

        { quoted: m }

      );

    }

    if (sub === "on") {

      await setAntiFloodConfig(from, { enabled: true });

      return sock.sendMessage(from, { text: "✅ AntiFlood enabled." }, { quoted: m });

    }

    if (sub === "off") {

      await setAntiFloodConfig(from, { enabled: false });

      return sock.sendMessage(from, { text: "✅ AntiFlood disabled." }, { quoted: m });

    }

    if (sub === "reset") {

      await setAntiFloodConfig(from, { warns: {} });

      return sock.sendMessage(from, { text: "✅ AntiFlood warns reset for this group." }, { quoted: m });

    }

    if (sub === "warnlimit") {

      const n = Number(args[1]);

      if (!Number.isFinite(n) || n < 1 || n > 20) {

        return sock.sendMessage(from, { text: "Usage: antiflood warnlimit 3" }, { quoted: m });

      }

      await setAntiFloodConfig(from, { warnLimit: Math.floor(n) });

      return sock.sendMessage(from, { text: `✅ Warn limit set to ${Math.floor(n)}.` }, { quoted: m });

    }

    if (sub === "set") {

      const sec = Number(args[1]);

      const max = Number(args[2]);

      if (!Number.isFinite(sec) || !Number.isFinite(max) || sec < 2 || max < 2) {

        return sock.sendMessage(

          from,

          { text: "Usage: antiflood set <seconds>=2+ <maxMsgs>=2+\nExample: antiflood set 6 6" },

          { quoted: m }

        );

      }

      await setAntiFloodConfig(from, { windowSec: Math.floor(sec), maxMsgs: Math.floor(max) });

      return sock.sendMessage(

        from,

        { text: `✅ AntiFlood set to ${Math.floor(max)} msgs / ${Math.floor(sec)}s.` },

        { quoted: m }

      );

    }

    return sock.sendMessage(from, { text: "❌ Unknown option. Type: antiflood" }, { quoted: m });

  },

};