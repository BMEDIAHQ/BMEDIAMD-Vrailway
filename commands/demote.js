// commands/demote.js (ESM)

// Owner-only (same owner check as antilink: isOwner(m, sock))

// Demotes a mentioned/replied/typed number user from admin.

//

// Usage:

//   <prefix>demote @user

//   reply user -> <prefix>demote

//   <prefix>demote 2376xxxxxxx

//

// Reply:

// 🥀 @owner demoted @person from admin ✅

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

  name: "demote",

  aliases: ["removeadmin", "admindown"],

  category: "GROUP",

  description: "Demote a user from admin (Owner only).",

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

            `${prefix}demote @user\n` +

            `Reply a user then: ${prefix}demote\n` +

            `${prefix}demote 2376xxxxxxx`,

        },

        { quoted: m }

      );

    }

    try {

      await sock.groupParticipantsUpdate(from, [target], "demote");

    } catch (e) {

      const msg = String(e?.message || e);

      return sock.sendMessage(from, { text: `❌ Demote failed: ${msg}` }, { quoted: m });

    }

    const ownerTag = makeTag(owner);

    const targetTag = makeTag(target);

    return sock.sendMessage(

      from,

      {

        text: `🥀 ${ownerTag} demoted ${targetTag} from admin ✅`,

        mentions: [owner, target],

      },

      { quoted: m }

    );

  },

};