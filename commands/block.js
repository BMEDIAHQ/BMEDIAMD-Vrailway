// commands/block.js (ESM)

// Owner-only: WhatsApp-level block (uses correct LID + pn_jid payload for Baileys rc.9)

//

// Usage:

//   .block @user

//   .block (reply)

//   .block 237xxxxxxxxx

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

const bare = (id) => String(id || "").split("@")[0].split(":")[0];

const tagOf = (jid) => `@${String(jid || "").split("@")[0].split(":")[0]}`;

// remove device id, keep domain

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

async function resolveForBlock(sock, inputJid) {

  const lidMap = sock?.signalRepository?.lidMapping;

  if (!lidMap) {

    throw new Error("LID mapping store not available on this socket. Update Baileys / ensure v7 socket exposes signalRepository.");

  }

  const normalized = normalizeJid(inputJid);

  // If input is already LID

  if (isLid(normalized)) {

    const lid = normalized;

    const pn = await lidMap.getPNForLID(lid).catch(() => null);

    if (!pn) {

      throw new Error(

        "I can't resolve this user's phone JID yet.\n" +

          "Ask them to message the bot once (or DM them), then try again."

      );

    }

    const pn_jid = normalizeJid(pn);

    return { lid, pn_jid };

  }

  // If input is PN -> must map to LID

  if (isPn(normalized)) {

    const pn_jid = normalized;

    const mappedLid = await lidMap.getLIDForPN(pn_jid).catch(() => null);

    if (!mappedLid) {

      throw new Error(

        "I can't resolve that number's LID yet.\n" +

          "Open a private chat with the person (or have them message the bot), then retry."

      );

    }

    const lid = normalizeJid(mappedLid);

    return { lid, pn_jid };

  }

  throw new Error("Invalid target JID.");

}

async function blocklistSet(sock, { action, jid, pn_jid }) {

  // WhatsApp expects:

  // - jid = LID always

  // - pn_jid ONLY when action === "block"

  const itemAttrs = action === "block" ? { action, jid, pn_jid } : { action, jid };

  return sock.query({

    tag: "iq",

    attrs: {

      xmlns: "blocklist",

      to: "s.whatsapp.net",

      type: "set",

    },

    content: [{ tag: "item", attrs: itemAttrs }],

  });

}

export default {

  name: "block",

  aliases: ["blk"],

  category: "OWNER",

  description: "Owner-only: WhatsApp-level block a user (mention/reply/number).",

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

    // If no target and in DM, block the chat partner

    if (!target && from && !String(from).endsWith("@g.us")) {

      target = from;

    }

    if (!target) {

      return sock.sendMessage(

        from,

        { text: "Usage: block @user | (reply) | block 237xxxxxxxxx" },

        { quoted: m }

      );

    }

    try {

      const { lid, pn_jid } = await resolveForBlock(sock, target);

      await blocklistSet(sock, { action: "block", jid: lid, pn_jid });

      // Mention using PN for clean tag (real number), not LID

      const mentionJid = pn_jid || normalizeJid(target);

      return sock.sendMessage(

        from,

        { text: `✅ Blocked ${tagOf(mentionJid)}.`, mentions: [mentionJid] },

        { quoted: m }

      );

    } catch (e) {

      const msg = String(e?.message || e);

      return sock.sendMessage(

        from,

        {

          text:

            `❌ Block error: ${msg}\n\n` +

            `Tip: If you just met the user in a group, DM them first (or let them DM the bot) so LID/PN mapping is available.`,

        },

        { quoted: m }

      );

    }

  },

};