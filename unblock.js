// commands/unblock.js (ESM)

// Owner-only: WhatsApp-level unblock (uses correct LID payload for Baileys rc.9)

//

// Usage:

//   .unblock @user

//   .unblock (reply)

//   .unblock 237xxxxxxxxx

import { isOwner } from "../checks/isOwner.js";

function unwrapMessage(msg) {

  if (!msg) return null;

  if (msg.ephemeralMessage?.message) return unwrapMessage(msg.ephemeralMessage.message);

  if (msg.viewOnceMessage?.message) return unwrapMessage(msg.viewOnceMessage.message);

  if (msg.viewOnceMessageV2?.message) return unwrapMessage(msg.viewOnceMessageV2.message);

  if (msg.documentWithCaptionMessage?.message) return unwrapMessage(msg.documentWithCaptionMessage.message);

  return msg;

}

function getContextInfo(m) {

  const msg = unwrapMessage(m?.message) || {};

  return (

    msg?.extendedTextMessage?.contextInfo ||

    msg?.imageMessage?.contextInfo ||

    msg?.videoMessage?.contextInfo ||

    msg?.stickerMessage?.contextInfo ||

    Object.values(msg).find((v) => v?.contextInfo)?.contextInfo ||

    null

  );

}

function getMentionedJids(m) {

  return getContextInfo(m)?.mentionedJid || [];

}

function getQuotedParticipant(m) {

  const ctx = getContextInfo(m);

  return ctx?.participant || null;

}

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender || m?.key?.remoteJid || null;

}

const tagOf = (jid) => `@${String(jid || "").split("@")[0].split(":")[0]}`;

function normalizeJid(jid) {

  const s = String(jid || "");

  const at = s.indexOf("@");

  if (at === -1) return s;

  const user = s.slice(0, at).split(":")[0];

  const server = s.slice(at + 1);

  return `${user}@${server}`;

}

function toPnJidFromNumber(input) {

  const n = String(input || "").trim().replace(/[^\d]/g, "");

  if (!n) return null;

  return `${n}@s.whatsapp.net`;

}

function isPn(jid) {

  return String(jid || "").endsWith("@s.whatsapp.net");

}

function isLid(jid) {

  return String(jid || "").endsWith("@lid");

}

async function resolveForUnblock(sock, inputJid) {

  const lidMap = sock?.signalRepository?.lidMapping;

  if (!lidMap) {

    throw new Error("LID mapping store not available on this socket.");

  }

  const normalized = normalizeJid(inputJid);

  if (isLid(normalized)) return { lid: normalized, pn: null };

  if (isPn(normalized)) {

    const mappedLid = await lidMap.getLIDForPN(normalized).catch(() => null);

    if (!mappedLid) {

      throw new Error(

        "I can't resolve that number's LID yet.\n" +

          "DM the person once (or let them DM the bot), then retry."

      );

    }

    return { lid: normalizeJid(mappedLid), pn: normalized };

  }

  throw new Error("Invalid target JID.");

}

async function blocklistSet(sock, { action, jid }) {

  return sock.query({

    tag: "iq",

    attrs: {

      xmlns: "blocklist",

      to: "s.whatsapp.net",

      type: "set",

    },

    content: [{ tag: "item", attrs: { action, jid } }],

  });

}

export default {

  name: "unblock",

  aliases: ["unblk"],

  category: "OWNER",

  description: "Owner-only: WhatsApp-level unblock a user (mention/reply/number).",

  async execute(ctx) {

    const { sock, m, from, args = [] } = ctx;

    const sender = getSender(m);

    if (!sender) return;

    if (!isOwner(m, sock)) {

      return sock.sendMessage(

        from,

        { text: `❌ Owner only.\n\n${tagOf(sender)}`, mentions: [sender] },

        { quoted: m }

      );

    }

    const mentioned = getMentionedJids(m);

    const replied = getQuotedParticipant(m);

    const typed = args[0] ? toPnJidFromNumber(args[0]) : null;

    let target = mentioned?.[0] || replied || typed;

    // If no target and in DM, unblock the chat partner

    if (!target && from && !String(from).endsWith("@g.us")) {

      target = from;

    }

    if (!target) {

      return sock.sendMessage(

        from,

        { text: "Usage: unblock @user | (reply) | unblock 237xxxxxxxxx" },

        { quoted: m }

      );

    }

    try {

      const { lid, pn } = await resolveForUnblock(sock, target);

      await blocklistSet(sock, { action: "unblock", jid: lid });

      const mentionJid = pn || normalizeJid(target);

      return sock.sendMessage(

        from,

        { text: `✅ Unblocked ${tagOf(mentionJid)}.`, mentions: [mentionJid] },

        { quoted: m }

      );

    } catch (e) {

      const msg = String(e?.message || e);

      return sock.sendMessage(

        from,

        { text: `❌ Unblock error: ${msg}` },

        { quoted: m }

      );

    }

  },

};