// commands/dare.js (ESM)

// Usage: <prefix>dare

// If you reply to someone or mention someone: it tags them in the dare question.

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

  name: "dare",

  aliases: ["d", "dareq"],

  category: "FUN",

  description: "Send a dare (optionally tag someone).",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    try {

      // Decide target (mentioned > replied > none)

      const mentions = getMentionedJids(m);

      const repliedUser = getQuotedParticipant(m);

      const targetJid = mentions?.[0] || repliedUser || null;

      // Fetch dare question

      const res = await fetch("https://api.truthordarebot.xyz/api/dare", {

        method: "GET",

        headers: { accept: "application/json" },

      });

      if (!res.ok) {

        return sock.sendMessage(

          from,

          { text: `❌ Dare error: API returned HTTP ${res.status}` },

          { quoted: m }

        );

      }

      const data = await res.json().catch(() => null);

      // API formats sometimes differ; try common keys

      const question =

        String(data?.question || data?.dare || data?.text || "").trim();

      if (!question) {

        return sock.sendMessage(

          from,

          { text: "❌ Dare error: Empty question from API." },

          { quoted: m }

        );

      }

      if (targetJid) {

        const tag = tagOf(targetJid);

        return sock.sendMessage(

          from,

          {

            text: `*DARE:*\n\n${tag} ${question}`,

            mentions: [targetJid],

          },

          { quoted: m }

        );

      }

      return sock.sendMessage(from, { text: `*DARE:*\n\n${question}` }, { quoted: m });

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ Dare error: ${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};