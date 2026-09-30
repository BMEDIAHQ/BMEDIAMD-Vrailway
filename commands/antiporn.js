// commands/antiporn.js (ESM)

// ✅ 100% bot-admin check (same style as promote/demote: groupMetadata() + participant match)

// Owner-only controls for AntiPorn (group-specific)

//

// Usage:

//  antiporn on            -> enable (mode: delete)

//  antiporn delete        -> enable (mode: delete)

//  antiporn warn          -> enable (mode: warn)

//  antiporn kick          -> enable (mode: kick)

//  antiporn off           -> disable

//  antiporn warnlimit 3   -> set warn limit

//  antiporn reset         -> reset warns (this group)

import { isOwner } from "../checks/isOwner.js";

import { getAntiPornConfig, setAntiPornConfig } from "../control/antiPornHandler.js";

const bare = (id) => String(id || "").split("@")[0].split(":")[0];

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender;

}

// ✅ bot-admin check exactly like promote/demote patterns:

// - fetch groupMetadata

// - find bot participant by matching bare number (works for jid/lid/deviceid)

// - admin if participant.admin is truthy

async function isBotAdmin(sock, groupJid) {

  try {

    const meta = await sock.groupMetadata(groupJid);

    // try multiple possible bot ids (some builds expose different fields)

    const candidates = [

      sock?.user?.id,

      sock?.user?.jid,

      sock?.user?.lid,

      sock?.user?.user?.id,

      sock?.user?.user?.jid,

      sock?.user?.user?.lid,

    ]

      .map(bare)

      .filter(Boolean);

    if (!candidates.length) return false;

    const me = (meta.participants || []).find((p) => candidates.includes(bare(p.id)));

    return Boolean(me?.admin); // admin or superadmin

  } catch {

    return false;

  }

}

export default {

  name: "antiporn",

  aliases: ["aporn"],

  category: "OWNER",

  description: "Owner-only: antiporn on|delete|warn|kick|off + warnlimit/reset",

  async execute(ctx) {

    const { sock, m, from, args = [] } = ctx;

    if (!String(from || "").endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "This command works in groups only." }, { quoted: m });

    }

    const sender = getSender(m);

    if (!sender) return;

    // Owner-only (your existing check)

    if (!isOwner(m, sock)) {

      const tag = `@${sender.split("@")[0].split(":")[0]}`;

      return sock.sendMessage(

        from,

        { text: `❌ Owner only.\n\n${tag}`, mentions: [sender] },

        { quoted: m }

      );

    }

    // ✅ bot must be admin for delete/kick actions

    const botIsAdmin = await isBotAdmin(sock, from);

    if (!botIsAdmin) {

      return sock.sendMessage(

        from,

        { text: "❌ I must be an admin in this group for AntiPorn to delete/kick messages." },

        { quoted: m }

      );

    }

    const sub = String(args[0] || "").toLowerCase();

    if (!sub || sub === "on" || sub === "delete") {

      await setAntiPornConfig(from, { enabled: true, mode: "delete" });

      return sock.sendMessage(from, { text: "✅ AntiPorn enabled (mode: delete)." }, { quoted: m });

    }

    if (sub === "warn") {

      await setAntiPornConfig(from, { enabled: true, mode: "warn" });

      const cfg = await getAntiPornConfig(from);

      return sock.sendMessage(

        from,

        { text: `✅ AntiPorn enabled (mode: warn).\n⚠️ Warn limit: ${cfg.warnLimit}` },

        { quoted: m }

      );

    }

    if (sub === "kick") {

      await setAntiPornConfig(from, { enabled: true, mode: "kick" });

      return sock.sendMessage(from, { text: "✅ AntiPorn enabled (mode: kick)." }, { quoted: m });

    }

    if (sub === "off") {

      await setAntiPornConfig(from, { enabled: false });

      return sock.sendMessage(from, { text: "✅ AntiPorn disabled." }, { quoted: m });

    }

    if (sub === "warnlimit") {

      const n = Number(args[1]);

      if (!Number.isFinite(n) || n < 1) {

        return sock.sendMessage(from, { text: "Usage: antiporn warnlimit 3" }, { quoted: m });

      }

      await setAntiPornConfig(from, { warnLimit: Math.floor(n) });

      const updated = await getAntiPornConfig(from);

      return sock.sendMessage(

        from,

        { text: `✅ Warn limit set to: ${updated.warnLimit}` },

        { quoted: m }

      );

    }

    if (sub === "reset") {

      await setAntiPornConfig(from, { warns: {} });

      return sock.sendMessage(from, { text: "✅ AntiPorn warns reset for this group." }, { quoted: m });

    }

    return sock.sendMessage(

      from,

      {

        text:

          "📌 AntiPorn:\n" +

          "• antiporn on / delete\n" +

          "• antiporn warn\n" +

          "• antiporn kick\n" +

          "• antiporn off\n" +

          "• antiporn warnlimit <number>\n" +

          "• antiporn reset",

      },

      { quoted: m }

    );

  },

};