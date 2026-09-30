// commands/setdesc.js (ESM)

// Admin OR Owner only:

// - Owner check: same as antilink (isOwner(m, sock))

// - Admin check: same method as your working commands (groupMetadata + bare compare)

//

// Usage:

//   <prefix>setdesc <new description>

//

// Reply format (tags using your working method):

// @owner changed the group description:

// Old: ...

// New: ...

import { isOwner } from "../checks/isOwner.js";

function pickSender(m, senderJid) {

  return m?.key?.participant || m?.participant || m?.sender || senderJid || "";

}

function bare(id) {

  return String(id || "").split("@")[0].split(":")[0];

}

async function isAdmin(sock, groupJid, sender) {

  try {

    const meta = await sock.groupMetadata(groupJid);

    const sb = bare(sender);

    const me = (meta.participants || []).find((p) => bare(p.id) === sb);

    return Boolean(me?.admin); // admin or superadmin

  } catch {

    return false;

  }

}

export default {

  name: "setdesc",

  aliases: ["setdescription", "gdesc"],

  category: "GROUP",

  description: "Change group description (Admin/Owner).",

  async execute(ctx) {

    const { sock, m, from, args, prefix, senderJid } = ctx;

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "This command works in groups only." }, { quoted: m });

    }

    const sender = pickSender(m, senderJid);

    if (!sender) return;

    // ✅ Owner check (same as AntiLink)

    const ownerOk = await isOwner(m, sock);

    // ✅ Admin check (same groupMetadata method used elsewhere)

    const adminOk = await isAdmin(sock, from, sender);

    if (!ownerOk && !adminOk) {

      return sock.sendMessage(from, { text: "❌ Admin/Owner only." }, { quoted: m });

    }

    const newDesc = String(args?.join(" ") || "").trim();

    if (!newDesc) {

      return sock.sendMessage(from, { text: `Usage: ${prefix}setdesc <new description>` }, { quoted: m });

    }

    // Fetch old description

    let oldDesc = "Unknown";

    try {

      const meta = await sock.groupMetadata(from);

      oldDesc = meta?.desc || meta?.description || "No description";

    } catch {

      oldDesc = "No description";

    }

    // Update description

    try {

      await sock.groupUpdateDescription(from, newDesc);

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

          `${tag} changed the group description:\n\n` +

          `Old:\n${oldDesc}\n\n` +

          `New:\n${newDesc}`,

        mentions: [sender],

      },

      { quoted: m }

    );

  },

};