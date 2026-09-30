// commands/joingroup.js

import { isOwner } from "../checks/isOwner.js";

function extractText(msg) {

  return (

    msg?.conversation ||

    msg?.extendedTextMessage?.text ||

    msg?.imageMessage?.caption ||

    msg?.videoMessage?.caption ||

    msg?.documentMessage?.caption ||

    ""

  );

}

function getQuotedMessage(m) {

  return (

    m?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||

    m?.message?.imageMessage?.contextInfo?.quotedMessage ||

    m?.message?.videoMessage?.contextInfo?.quotedMessage ||

    m?.message?.documentMessage?.contextInfo?.quotedMessage ||

    m?.msg?.contextInfo?.quotedMessage ||

    null

  );

}

function unwrapMessage(msg) {

  let x = msg || {};

  for (let i = 0; i < 6; i++) {

    if (x?.ephemeralMessage?.message) {

      x = x.ephemeralMessage.message;

      continue;

    }

    if (x?.viewOnceMessageV2?.message) {

      x = x.viewOnceMessageV2.message;

      continue;

    }

    if (x?.viewOnceMessage?.message) {

      x = x.viewOnceMessage.message;

      continue;

    }

    break;

  }

  return x || {};

}

function extractInviteCode(text = "") {

  const s = String(text || "").trim();

  const linkMatch = s.match(/https?:\/\/chat\.whatsapp\.com\/([A-Za-z0-9]+)/i);

  if (linkMatch?.[1]) return linkMatch[1];

  const codeMatch = s.match(/\b([A-Za-z0-9]{20,30})\b/);

  if (codeMatch?.[1]) return codeMatch[1];

  return "";

}

export default {

  name: "joingroup",

  aliases: ["joinlink", "joingc", "join"],

  category: "OWNER",

  description: "Join a WhatsApp group from a typed link or a replied message link.",

  usage: "joingroup <chat.whatsapp.com/...> OR reply to a message containing the link",

  async execute(ctx) {

    const { sock, m, from, args = [] } = ctx;

    if (!isOwner(m, sock)) {

      return sock.sendMessage(

        from,

        { text: "❌ Owner only." },

        { quoted: m }

      );

    }

    let code = "";

    // 1) typed link/code

    const typedText = String(args.join(" ") || "").trim();

    if (typedText) {

      code = extractInviteCode(typedText);

    }

    // 2) replied message text/caption

    if (!code) {

      const quoted = unwrapMessage(getQuotedMessage(m));

      const quotedText = extractText(quoted);

      if (quotedText) {

        code = extractInviteCode(quotedText);

      }

    }

    if (!code) {

      return sock.sendMessage(

        from,

        {

          text:

            "❌ No valid WhatsApp group link found.\n\n" +

            "Use:\n" +

            "• joingroup https://chat.whatsapp.com/XXXXXXXX\n" +

            "• or reply to a message containing the group link",

        },

        { quoted: m }

      );

    }

    try {

      const info = await sock.groupGetInviteInfo(code);

      const groupJid = info?.id || info?.jid || "";

      try {

        const allGroups = await sock.groupFetchAllParticipating();

        if (groupJid && allGroups && allGroups[groupJid]) {

          return sock.sendMessage(

            from,

            {

              text:

                `ℹ️ Already in group.\n` +

                `🏷️ ${info?.subject || "Unknown Group"}\n` +

                `🆔 ${groupJid}`,

            },

            { quoted: m }

          );

        }

      } catch {}

      const joinedJid = await sock.groupAcceptInvite(code);

      return sock.sendMessage(

        from,

        {

          text:

            `✅ Joined successfully.\n` +

            `🏷️ ${info?.subject || "Unknown Group"}\n` +

            `🆔 ${joinedJid || groupJid || "Unknown"}`,

        },

        { quoted: m }

      );

    } catch (e) {

      const msg = String(e?.message || e || "");

      if (/already/i.test(msg)) {

        return sock.sendMessage(

          from,

          { text: "ℹ️ Already in that group." },

          { quoted: m }

        );

      }

      return sock.sendMessage(

        from,

        { text: `❌ Failed to join group.\n${msg}` },

        { quoted: m }

      );

    }

  },

};