// commands/antispam.js (ESM)

// Owner-only AntiSpam controls (group-specific)

import { isOwner } from "../checks/isOwner.js";

import { getAntiSpamConfig, setAntiSpamConfig } from "../control/antiSpamHandler.js";

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender;

}

export default {

  name: "antispam",

  aliases: ["aspam"],

  category: "OWNER",

  description: "Owner-only: AntiSpam rate-limit repeated spam in groups.",

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

      const cfg = await getAntiSpamConfig(from);

      return sock.sendMessage(

        from,

        {

          text:

            `🛡️ *AntiSpam Settings*\n\n` +

            `• Status: ${cfg.enabled ? "✅ ON" : "❌ OFF"}\n` +

            `• Window: ${cfg.windowSec}s\n` +

            `• Max msgs/window: ${cfg.maxMsgs}\n` +

            `• Repeat limit: ${cfg.repeatLimit}\n` +

            `• Warn limit: ${cfg.warnLimit}\n\n` +

            `Commands:\n` +

            `• antispam on|off\n` +

            `• antispam set window 8\n` +

            `• antispam set max 5\n` +

            `• antispam set repeat 3\n` +

            `• antispam warnlimit 3\n` +

            `• antispam reset`,

        },

        { quoted: m }

      );

    }

    if (sub === "on") {

      await setAntiSpamConfig(from, { enabled: true });

      return sock.sendMessage(from, { text: "✅ AntiSpam enabled." }, { quoted: m });

    }

    if (sub === "off") {

      await setAntiSpamConfig(from, { enabled: false });

      return sock.sendMessage(from, { text: "✅ AntiSpam disabled." }, { quoted: m });

    }

    if (sub === "reset") {

      await setAntiSpamConfig(from, { warns: {} });

      return sock.sendMessage(from, { text: "✅ AntiSpam warns reset for this group." }, { quoted: m });

    }

    if (sub === "warnlimit") {

      const n = Number(args[1]);

      if (!Number.isFinite(n) || n < 1 || n > 20) {

        return sock.sendMessage(from, { text: "Usage: antispam warnlimit 3" }, { quoted: m });

      }

      await setAntiSpamConfig(from, { warnLimit: Math.floor(n) });

      return sock.sendMessage(from, { text: `✅ Warn limit set to ${Math.floor(n)}.` }, { quoted: m });

    }

    if (sub === "set") {

      const key = String(args[1] || "").toLowerCase();

      const val = Number(args[2]);

      if (!["window", "max", "repeat"].includes(key) || !Number.isFinite(val)) {

        return sock.sendMessage(

          from,

          { text: "Usage:\nantispam set window 8\nantispam set max 5\nantispam set repeat 3" },

          { quoted: m }

        );

      }

      if (key === "window") {

        await setAntiSpamConfig(from, { windowSec: Math.max(2, Math.floor(val)) });

        return sock.sendMessage(from, { text: "✅ Window updated." }, { quoted: m });

      }

      if (key === "max") {

        await setAntiSpamConfig(from, { maxMsgs: Math.max(2, Math.floor(val)) });

        return sock.sendMessage(from, { text: "✅ Max messages updated." }, { quoted: m });

      }

      if (key === "repeat") {

        await setAntiSpamConfig(from, { repeatLimit: Math.max(2, Math.floor(val)) });

        return sock.sendMessage(from, { text: "✅ Repeat limit updated." }, { quoted: m });

      }

    }

    return sock.sendMessage(from, { text: "❌ Unknown option. Type: antispam" }, { quoted: m });

  },

};