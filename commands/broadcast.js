// commands/broadcast.js (ESM)

// Owner-only (same owner check as your antilink command: isOwner(m, sock))

// Sends a broadcast message to ALL groups the bot is in, with a safe confirm step.

//

// Flow:

// 1) <prefix>broadcast <message>

//    -> bot previews and asks you to confirm by sending:

//       BMEDIA CONFIRM <token>

// 2) <prefix>broadcastconfirm <token>

//    -> sends to all groups

//

// Notes:

// - No mentions

// - 2 minute timeout

// - Throttled to reduce spam/ban risk

import { isOwner } from "../checks/isOwner.js";

const PENDING = new Map(); // key: ownerJidBare -> { token, text, groups, expiresAt }

function getText(m) {

  return (

    m?.message?.conversation ||

    m?.message?.extendedTextMessage?.text ||

    m?.message?.imageMessage?.caption ||

    m?.message?.videoMessage?.caption ||

    ""

  );

}

function pickSender(m, senderJid) {

  return m?.key?.participant || m?.participant || m?.sender || senderJid || "";

}

function bare(id) {

  return String(id || "").split("@")[0].split(":")[0];

}

function token6() {

  return Math.random().toString(36).slice(2, 8).toUpperCase();

}

function sleep(ms) {

  return new Promise((r) => setTimeout(r, ms));

}

async function getAllGroups(sock) {

  // Baileys: groupFetchAllParticipating() returns map

  const map = await sock.groupFetchAllParticipating();

  return Object.keys(map || {}).filter((jid) => jid.endsWith("@g.us"));

}

export default {

  name: "broadcast",

  aliases: ["bc", "announceall"],

  category: "OWNER",

  description: "Broadcast a message to all groups (Owner only, confirm required).",

  async execute(ctx) {

    const { sock, m, from, args, prefix, senderJid } = ctx;

    // ✅ Owner check (same as AntiLink command)

    const ok = await isOwner(m, sock);

    if (!ok) return sock.sendMessage(from, { text: "❌ Owner only." }, { quoted: m });

    const sender = pickSender(m, senderJid);

    if (!sender) return;

    const msg = String(args?.join(" ") || "").trim();

    if (!msg) {

      return sock.sendMessage(

        from,

        { text: `Usage: ${prefix}broadcast <message>` },

        { quoted: m }

      );

    }

    let groups = [];

    try {

      groups = await getAllGroups(sock);

    } catch (e) {

      const emsg = String(e?.message || e);

      return sock.sendMessage(from, { text: `❌ Failed to fetch groups: ${emsg}` }, { quoted: m });

    }

    if (!groups.length) {

      return sock.sendMessage(from, { text: "❌ No groups found." }, { quoted: m });

    }

    const t = token6();

    const key = bare(sender);

    PENDING.set(key, {

      token: t,

      text: msg,

      groups,

      expiresAt: Date.now() + 120_000, // 2 min

    });

    return sock.sendMessage(

      from,

      {

        text:

          `📣 Broadcast Preview\n\n` +

          `Message:\n${msg}\n\n` +

          `Targets: ${groups.length} group(s)\n\n` +

          `✅ To confirm, send:\n` +

          `*${prefix}broadcastconfirm ${t}*\n\n` +

          `⏳ Expires in 2 minutes.`,

      },

      { quoted: m }

    );

  },

};