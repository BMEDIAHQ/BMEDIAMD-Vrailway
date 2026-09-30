// commands/setgcpp.js (ESM)

// Change GROUP profile picture (Owner OR Group Admin)

// Usage: reply to an image with: <prefix>setppgc

import { downloadContentFromMessage } from "@whiskeysockets/baileys";

import { isOwner } from "../checks/isOwner.js";

async function streamToBuffer(stream) {

  const chunks = [];

  for await (const c of stream) chunks.push(c);

  return Buffer.concat(chunks);

}

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender;

}

function getQuotedMessage(m) {

  return m?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;

}

const bare = (id) => String(id || "").split("@")[0].split(":")[0];

async function isGroupAdmin(sock, groupJid, userId) {

  try {

    const meta = await sock.groupMetadata(groupJid);

    const userBare = bare(userId);

    const p = (meta.participants || []).find((x) => bare(x.id) === userBare);

    return Boolean(p?.admin); // admin or superadmin

  } catch {

    return false;

  }

}

export default {

  name: "setgcpp",

  aliases: ["setppgc", "gcpp"],

  category: "GROUP",

  description: "Change group profile picture (reply an image).",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    if (!String(from || "").endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "This command works in groups only." }, { quoted: m });

    }

    const sender = getSender(m);

    if (!sender) return;

    // Owner OR group admin

    const owner = isOwner(m, sock);

    const admin = await isGroupAdmin(sock, from, sender);

    if (!owner && !admin) {

      const tag = `@${sender.split("@")[0].split(":")[0]}`;

      return sock.sendMessage(

        from,

        { text: `❌ Admin/Owner only.\n\n${tag}`, mentions: [sender] },

        { quoted: m }

      );

    }

    // Must reply to an image

    const quoted = getQuotedMessage(m);

    const imgMsg = quoted?.imageMessage;

    if (!imgMsg) {

      return sock.sendMessage(

        from,

        { text: "Reply to an image with: setgcpp" },

        { quoted: m }

      );

    }

    try {

      const stream = await downloadContentFromMessage(imgMsg, "image");

      const buf = await streamToBuffer(stream);

      // ✅ Update group profile picture

      await sock.updateProfilePicture(from, buf);

      const tag = `@${sender.split("@")[0].split(":")[0]}`;

      return sock.sendMessage(

        from,

        { text: `✅ ${tag} changed the group picture.`, mentions: [sender] },

        { quoted: m }

      );

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ setgcpp error: ${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};