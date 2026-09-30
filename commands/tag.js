// commands/tag.js (ESM)

// Hidden-tag everyone in a group.

// Usage:

//   <prefix>tag <text>

//   Reply a message + <prefix>tag

//

// Notes:

// - "Hidden mention" = mentions array includes everyone, but message text has no @numbers.

// - After sending, if the command message is yours, bot tries to edit it to "." (fallback delete).

import { isOwner } from "../checks/isOwner.js";

function getText(m) {

  return (

    m?.message?.conversation ||

    m?.message?.extendedTextMessage?.text ||

    m?.message?.imageMessage?.caption ||

    m?.message?.videoMessage?.caption ||

    m?.message?.documentMessage?.caption ||

    ""

  );

}

function getQuoted(m) {

  return m?.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;

}

function getQuotedText(m) {

  const q = getQuoted(m);

  if (!q) return "";

  return (

    q?.conversation ||

    q?.extendedTextMessage?.text ||

    q?.imageMessage?.caption ||

    q?.videoMessage?.caption ||

    q?.documentMessage?.caption ||

    ""

  );

}

export default {

  name: "tag",

  aliases: [],

  category: "GROUP",

  description: "Hidden-tag all members (reply a message or type text).",

  async execute(ctx) {

    const { sock, m, from, args } = ctx;

    if (!from?.endsWith("@g.us")) {

      return sock.sendMessage(from, { text: "❌ This command works in groups only." }, { quoted: m });

    }

    // ✅ Owner-only (same check style as your AntiLink)

    if (!isOwner(m, sock)) {

      return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });

    }

    const typed = String(args?.join(" ") || "").trim();

    const replied = String(getQuotedText(m) || "").trim();

    const content = replied || typed;

    if (!content) {

      return sock.sendMessage(

        from,

        { text: "❌ Reply to a message or type a message.\n\nExample:\n tag Hello everyone" },

        { quoted: m }

      );

    }

    // Get participants

    let meta;

    try {

      meta = await sock.groupMetadata(from);

    } catch (e) {

      return sock.sendMessage(from, { text: "❌ Failed to read group members." }, { quoted: m });

    }

    const participants = (meta?.participants || []).map((p) => p.id).filter(Boolean);

    if (!participants.length) {

      return sock.sendMessage(from, { text: "❌ No participants found." }, { quoted: m });

    }

    // Send hidden-tag message (no @text, only mentions array)

    await sock.sendMessage(

      from,

      {

        text: content,

        mentions: participants,

      },

      { quoted: m }

    );

    // If the command message is yours, edit it to "." (fallback delete)

    if (m?.key?.fromMe) {

      // Try edit first

      try {

        await sock.sendMessage(from, { text: ".", edit: m.key });

        return;

      } catch {}

      // Fallback: delete the command message

      try {

        await sock.sendMessage(from, { delete: m.key });

      } catch {}

    }

  },

};