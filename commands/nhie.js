// commands/nhie.js (ESM)

// Never Have I Ever

// Usage: <prefix>nhie

// If you reply to someone or mention someone: it tags them in the question.

function getContextInfo(m) {

  return m?.message?.extendedTextMessage?.contextInfo || null;

}

function getMentionedJids(m) {

  const ctx = getContextInfo(m);

  return ctx?.mentionedJid || [];

}

function getQuotedParticipant(m) {

  const ctx = getContextInfo(m);

  return ctx?.participant || null;

}

function tagOf(jid) {

  return `@${String(jid || "").split("@")[0].split(":")[0]}`;

}

export default {

  name: "nhie",

  aliases: ["neverhaveiever", "neverever"],

  category: "FUN",

  description: "Never Have I Ever question (optionally tag someone).",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    try {

      // Decide target (mentioned > replied > none)

      const mentions = getMentionedJids(m);

      const repliedUser = getQuotedParticipant(m);

      const targetJid = mentions?.[0] || repliedUser || null;

      const res = await fetch("https://api.truthordarebot.xyz/api/nhie", {

        method: "GET",

        headers: { accept: "application/json" },

      });

      if (!res.ok) {

        return sock.sendMessage(

          from,

          { text: `❌ NHIE error: API returned HTTP ${res.status}` },

          { quoted: m }

        );

      }

      const data = await res.json().catch(() => null);

      const question = String(data?.question || data?.nhie || data?.text || "").trim();

      if (!question) {

        return sock.sendMessage(

          from,

          { text: "❌ NHIE error: Empty question from API." },

          { quoted: m }

        );

      }

      if (targetJid) {

        const tag = tagOf(targetJid);

        return sock.sendMessage(

          from,

          { text: `*NEVER HAVE I EVER:*\n${tag} ${question}`, mentions: [targetJid] },

          { quoted: m }

        );

      }

      return sock.sendMessage(from, { text: `*NEVER HAVE I EVER:*\n${question}` }, { quoted: m });

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ NHIE error: ${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};