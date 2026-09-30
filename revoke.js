// commands/revoke.js (ESM)

// Revoke/reset group invite link (admin/owner)

// Usage: <prefix>revoke

import { isOwner } from "../checks/isOwner.js";

function bare(id) {

  return String(id || "").split("@")[0].split(":")[0];

}

async function isAdminOrSuper(sock, groupJid, sender) {

  const meta = await sock.groupMetadata(groupJid);

  const sBare = bare(sender);

  const me = (meta.participants || []).find((p) => bare(p.id) === sBare);

  return Boolean(me?.admin);

}

export default {

  name: "revoke",

  aliases: ["resetlink", "revokelink"],

  category: "GROUP",

  description: "Revoke the group invite link (admin/owner).",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "This command works in groups only." }, { quoted: m });

    }

    const sender = m?.key?.participant || m?.participant || m?.sender;

    if (!sender) return;

    const ownerOk = isOwner(m, sock);

    let adminOk = false;

    try {

      adminOk = await isAdminOrSuper(sock, from, sender);

    } catch {}

    if (!ownerOk && !adminOk) {

      const tag = `@${sender.split("@")[0].split(":")[0]}`;

      return sock.sendMessage(

        from,

        { text: `❌ Owner/Admin only.\n\n${tag}`, mentions: [sender] },

        { quoted: m }

      );

    }

    try {

      await sock.groupRevokeInvite(from);

      const tag = `@${sender.split("@")[0].split(":")[0]}`;

      return sock.sendMessage(

        from,

        { text: `✅ ${tag} revoked the group invite link. 🔒`, mentions: [sender] },

        { quoted: m }

      );

    } catch (e) {

      return sock.sendMessage(from, { text: `❌ Revoke error: ${e?.message || e}` }, { quoted: m });

    }

  },

};