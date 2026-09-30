// commands/antifake.js (ESM)

// Owner-only AntiFake controls (group-specific)

import { isOwner } from "../checks/isOwner.js";

import { getAntiFakeConfig, setAntiFakeConfig } from "../control/antiFakeHandler.js";

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender;

}

function parseCodes(s = "") {

  return String(s)

    .split(/[,\s]+/)

    .map((x) => x.trim().replace(/^\+/, ""))

    .filter((x) => x && /^[0-9]{1,4}$/.test(x));

}

export default {

  name: "antifake",

  aliases: ["afake"],

  category: "OWNER",

  description: "Owner-only: block/allow country codes in group.",

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

      const cfg = await getAntiFakeConfig(from);

      return sock.sendMessage(

        from,

        {

          text:

            `🛡️ *AntiFake Settings*\n\n` +

            `• Status: ${cfg.enabled ? "✅ ON" : "❌ OFF"}\n` +

            `• Type: ${cfg.listType.toUpperCase()} list\n` +

            `• Mode: ${cfg.mode.toUpperCase()}\n` +

            `• Codes: ${cfg.codes.length ? cfg.codes.join(", ") : "(none)"}\n` +

            `• Warn limit: ${cfg.warnLimit}\n\n` +

            `Commands:\n` +

            `• antifake on|off\n` +

            `• antifake mode delete|warn|kick\n` +

            `• antifake type block|allow\n` +

            `• antifake codes 234,91,1\n` +

            `• antifake warnlimit 3\n` +

            `• antifake reset`,

        },

        { quoted: m }

      );

    }

    if (sub === "on") {

      await setAntiFakeConfig(from, { enabled: true });

      return sock.sendMessage(from, { text: "✅ AntiFake enabled." }, { quoted: m });

    }

    if (sub === "off") {

      await setAntiFakeConfig(from, { enabled: false });

      return sock.sendMessage(from, { text: "✅ AntiFake disabled." }, { quoted: m });

    }

    if (sub === "mode") {

      const mode = String(args[1] || "").toLowerCase();

      if (!["delete", "warn", "kick"].includes(mode)) {

        return sock.sendMessage(from, { text: "Usage: antifake mode delete|warn|kick" }, { quoted: m });

      }

      await setAntiFakeConfig(from, { mode });

      return sock.sendMessage(from, { text: `✅ Mode set to ${mode}.` }, { quoted: m });

    }

    if (sub === "type") {

      const type = String(args[1] || "").toLowerCase();

      if (!["block", "allow"].includes(type)) {

        return sock.sendMessage(from, { text: "Usage: antifake type block|allow" }, { quoted: m });

      }

      await setAntiFakeConfig(from, { listType: type });

      return sock.sendMessage(from, { text: `✅ List type set to ${type}.` }, { quoted: m });

    }

    if (sub === "codes") {

      const raw = args.slice(1).join(" ");

      const codes = parseCodes(raw);

      if (!codes.length) {

        return sock.sendMessage(from, { text: "Usage: antifake codes 234,91,1" }, { quoted: m });

      }

      await setAntiFakeConfig(from, { codes });

      return sock.sendMessage(from, { text: `✅ Codes set: ${codes.join(", ")}` }, { quoted: m });

    }

    if (sub === "warnlimit") {

      const n = Number(args[1]);

      if (!Number.isFinite(n) || n < 1 || n > 20) {

        return sock.sendMessage(from, { text: "Usage: antifake warnlimit 3" }, { quoted: m });

      }

      await setAntiFakeConfig(from, { warnLimit: Math.floor(n) });

      return sock.sendMessage(from, { text: `✅ Warn limit set to ${Math.floor(n)}.` }, { quoted: m });

    }

    if (sub === "reset") {

      await setAntiFakeConfig(from, { warns: {} });

      return sock.sendMessage(from, { text: "✅ AntiFake warns reset for this group." }, { quoted: m });

    }

    return sock.sendMessage(from, { text: "❌ Unknown option. Type: antifake" }, { quoted: m });

  },

};