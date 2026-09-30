// commands/setname.js (ESM)

// Owner-only (same owner check method as your antilink command)

// Changes group subject immediately (NO confirmation).

//

// After success it replies (tagging with the AntiLink method):

// @sender changed group name from:

// Old: <old name>

// New: <new name>

import { isOwner } from "../checks/isOwner.js";

function pickSender(m, senderJid) {

  return m?.key?.participant || m?.participant || m?.sender || senderJid || "";

}

export default {

  name: "setname",

  aliases: ["setsubject", "gname"],

  category: "GROUP",

  description: "Change group name (Owner only).",

  async execute(ctx) {

    const { sock, m, from, args, prefix, senderJid } = ctx;

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "This command works in groups only." }, { quoted: m });

    }

    // ✅ Owner check (same as your working AntiLink command)

    const ok = await isOwner(m, sock);

    if (!ok) {

      return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });

    }

    const sender = pickSender(m, senderJid);

    if (!sender) return;

    const newName = String(args?.join(" ") || "").trim();

    if (!newName) {

      return sock.sendMessage(from, { text: `Usage: ${prefix}setname <new group name>` }, { quoted: m });

    }

    // Get old name

    let oldName = "Unknown";

    try {

      const meta = await sock.groupMetadata(from);

      oldName = meta?.subject || oldName;

    } catch {}

    // Update subject

    try {

      await sock.groupUpdateSubject(from, newName);

    } catch (e) {

      const msg = String(e?.message || e);

      return sock.sendMessage(from, { text: `❌ Failed: ${msg}` }, { quoted: m });

    }

    // ✅ Tagging method from AntiLink

    const tag = `@${sender.split("@")[0].split(":")[0]}`;

    return sock.sendMessage(

      from,

      {

        text:

          `${tag} changed group name from:\n\n` +

          `Old: ${oldName}\n` +

          `New: ${newName}`,

        mentions: [sender],

      },

      { quoted: m }

    );

  },

};