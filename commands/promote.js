// commands/promote.js (ESM)

// Owner-only (same owner check as antilink: isOwner(m, sock))

// Promotes a mentioned/replied/typed number user to admin.

//

// Usage:

//   <prefix>promote @user

//   reply user -> <prefix>promote

//   <prefix>promote 2376xxxxxxx

//

// Reply:

// 👑 @owner promoted @person to admin ✅

import { isOwner } from "../checks/isOwner.js";

function pickSender(m, senderJid) {

  return m?.key?.participant || m?.participant || m?.sender || senderJid || "";

}

function getMentionedJid(m) {

  return m?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || "";

}

function getQuotedParticipant(m) {

  const ci = m?.message?.extendedTextMessage?.contextInfo;

  return ci?.participant || "";

}

function bare(id) {

  return String(id || "").split("@")[0].split(":")[0];

}

function numberToJid(n) {

  const digits = String(n || "").replace(/[^\d]/g, "");

  if (!digits) return "";

  return `${digits}@s.whatsapp.net`;

}

function pickTarget(m, args) {

  const mentioned = getMentionedJid(m);

  if (mentioned) return mentioned;

  const quoted = getQuotedParticipant(m);

  if (quoted) return quoted;

  const typed = String((args || []).join(" ") || "").trim();

  if (!typed) return "";

  if (typed.includes("@")) return typed;

  return numberToJid(typed);

}

function makeTag(id) {

  return `@${id.split("@")[0].split(":")[0]}`;

}

export default {

  name: "promote",

  aliases: ["makeadmin", "adminup"],

  category: "GROUP",

  description: "Promote a user to admin (Owner only).",

  async execute(ctx) {

    const { sock, m, from, args, prefix, senderJid } = ctx;

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "This command works in groups only." }, { quoted: m });

    }

    // ✅ Owner only (same as AntiLink command)

    const ok = await isOwner(m, sock);

    if (!ok) return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });

    const owner = pickSender(m, senderJid);

    if (!owner) return;

    const target = pickTarget(m, args);

    if (!target) {

      return sock.sendMessage(

        from,

        {

          text:

            `Usage:\n` +

            `${prefix}promote @user\n` +

            `Reply a user then: ${prefix}promote\n` +

            `${prefix}promote 2376xxxxxxx`,

        },

        { quoted: m }

      );

    }

    // If owner tries to promote themselves, allow it (WhatsApp may ignore if already admin)

    try {

      await sock.groupParticipantsUpdate(from, [target], "promote");

    } catch (e) {

      const msg = String(e?.message || e);

      return sock.sendMessage(from, { text: `❌ Promote failed: ${msg}` }, { quoted: m });

    }

    const ownerTag = makeTag(owner);

    const targetTag = makeTag(target);

    return sock.sendMessage(

      from,

      {

        text: `👑 ${ownerTag} promoted ${targetTag} to admin ✅`,

        mentions: [owner, target],

      },

      { quoted: m }

    );

  },

};