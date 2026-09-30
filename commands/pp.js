// commands/pp.js (ESM)

// Owner-only: Set BOT profile picture (not group)

// Usage: reply an image with: <prefix>pp

import { downloadContentFromMessage } from "@whiskeysockets/baileys";

import { isOwner } from "../checks/isOwner.js";

async function streamToBuffer(stream) {

  const chunks = [];

  for await (const c of stream) chunks.push(c);

  return Buffer.concat(chunks);

}

function getQuotedMessage(m) {

  return (

    m?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||

    m?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||

    null

  );

}

// Get a usable sender id (can be lid or jid)

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender || m?.key?.remoteJid;

}

// YOUR tagging method (same as your AntiLink)

function tagOf(jidOrLid) {

  return `@${String(jidOrLid || "").split("@")[0].split(":")[0]}`;

}

// Build bot JID from "@sender" style (your request)

function buildBotJidFromTag(sock) {

  // create the same "@sender" style from bot's own id

  const raw = String(sock?.user?.id || "");

  const number = raw.split("@")[0].split(":")[0]; // remove device part if any

  return `${number}@s.whatsapp.net`;

}

export default {

  name: "pp",

  aliases: ["setpp", "setpfp"],

  category: "OWNER",

  description: "Owner-only: Change bot profile picture (reply an image).",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    const sender = getSender(m);

    if (!sender) return;

    // Owner-only

    if (!isOwner(m, sock)) {

      const tag = tagOf(sender);

      return sock.sendMessage(

        from,

        { text: `❌ Owner only.\n\n${tag}`, mentions: [sender] },

        { quoted: m }

      );

    }

    // Must reply an image

    const quoted = getQuotedMessage(m);

    const imgMsg = quoted?.imageMessage;

    if (!imgMsg) {

      return sock.sendMessage(

        from,

        { text: "Reply to an image with: pp" },

        { quoted: m }

      );

    }

    try {

      const stream = await downloadContentFromMessage(imgMsg, "image");

      const buf = await streamToBuffer(stream);

      // ✅ Build bot jid correctly (your requested style)

      const botJid = buildBotJidFromTag(sock);

      // ✅ Update bot profile picture

      await sock.updateProfilePicture(botJid, buf);

      const tag = tagOf(sender);

      return sock.sendMessage(

        from,

        { text: `✅ ${tag} updated my profile picture.`, mentions: [sender] },

        { quoted: m }

      );

    } catch (e) {

      const msg = String(e?.message || e);

      return sock.sendMessage(from, { text: `❌ PP error: ${msg}` }, { quoted: m });

    }

  },

};
