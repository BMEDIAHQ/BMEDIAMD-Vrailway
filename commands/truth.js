// commands/truth.js (ESM)

// Usage: <prefix>truth

// If you reply to someone or mention someone: it tags them in the truth question.

function getText(m) {

  return (

    m?.message?.conversation ||

    m?.message?.extendedTextMessage?.text ||

    m?.message?.imageMessage?.caption ||

    m?.message?.videoMessage?.caption ||

    ""

  ).trim();

}

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender;

}

function getContextInfo(m) {

  return m?.message?.extendedTextMessage?.contextInfo || null;

}

function getMentionedJids(m) {

  const ctx = getContextInfo(m);

  return ctx?.mentionedJid || [];

}

function getQuotedParticipant(m) {

  const ctx = getContextInfo(m);

  // In Baileys, quoted participant (the user you replied to) is here:

  return ctx?.participant || null;

}

function tagOf(jid) {

  return `@${String(jid || "").split("@")[0].split(":")[0]}`;

}

export default {

  name: "truth",

  aliases: ["t", "truthq"],

  category: "FUN",

  description: "Send a truth question (optionally tag someone).",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    try {

      // 1) Decide target (mentioned > replied > none)

      const mentions = getMentionedJids(m);

      const repliedUser = getQuotedParticipant(m);

      const targetJid = mentions?.[0] || repliedUser || null;

      // 2) Fetch truth question

      const res = await fetch("https://api.truthordarebot.xyz/v1/truth", {

        method: "GET",

        headers: { accept: "application/json" },

      });

      if (!res.ok) {

        return sock.sendMessage(

          from,

          { text: `❌ Truth error: API returned HTTP ${res.status}` },

          { quoted: m }

        );

      }

      const data = await res.json().catch(() => null);

      const question = (data?.question || "").trim();

      if (!question) {

        return sock.sendMessage(

          from,

          { text: "❌ Truth error: Empty question from API." },

          { quoted: m }

        );

      }

      // 3) Build reply text (only question, optionally with mention)

      if (targetJid) {

        const tag = tagOf(targetJid);

        return sock.sendMessage(

          from,

          {

            text: `*TRUTH:* \n\n${tag} ${question}`,

            mentions: [targetJid],

          },

          { quoted: m }

        );

      }

      return sock.sendMessage(from, { text: `*TRUTH:* \n\n${question} `}, { quoted: m });

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ Truth error: ${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};