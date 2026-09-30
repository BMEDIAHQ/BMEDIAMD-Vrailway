// commands/admins.js (ESM)

// Lists all admins in a group and shows superadmin count.

// Tags using your working method.

//

// Usage: <prefix>admins

function pickSender(m, senderJid) {

  return m?.key?.participant || m?.participant || m?.sender || senderJid || "";

}

function bare(id) {

  return String(id || "").split("@")[0].split(":")[0];

}

export default {

  name: "admins",

  aliases: ["adminlist", "listadmins"],

  category: "GROUP",

  description: "List group admins and superadmin count.",

  async execute(ctx) {

    const { sock, m, from, senderJid } = ctx;

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "This command works in groups only." }, { quoted: m });

    }

    let meta;

    try {

      meta = await sock.groupMetadata(from);

    } catch (e) {

      const msg = String(e?.message || e);

      return sock.sendMessage(from, { text: `❌ Failed: ${msg}` }, { quoted: m });

    }

    const participants = meta?.participants || [];

    const admins = participants.filter((p) => Boolean(p?.admin)); // "admin" | "superadmin"

    const superAdmins = admins.filter((p) => p.admin === "superadmin");

    if (!admins.length) {

      return sock.sendMessage(from, { text: "No admins found in this group." }, { quoted: m });

    }

    // Build list + mentions

    const mentions = admins.map((a) => a.id);

    const lines = admins.map((a, i) => {

      const tag = `@${bare(a.id)}`;

      const role = a.admin === "superadmin" ? "👑" : "🛡️";

      return `${i + 1}. ${role} ${tag}`;

    });

    const sender = pickSender(m, senderJid);

    const footerTag = sender ? `\n\nRequested by @${bare(sender)}` : "";

    return sock.sendMessage(

      from,

      {

        text:

          `👮‍♂️ *Group Admins*\n` +

          `• Total admins: ${admins.length}\n` +

          `• Superadmins 👑: ${superAdmins.length}\n\n` +

          lines.join("\n") +

          footerTag,

        mentions: sender ? [...mentions, sender] : mentions,

      },

      { quoted: m }

    );

  },

};