// commands/roast.js (ESM)

// Fun roast command using: https://eliteprotech-apis.zone.id/insult

// Tags the replied-to or mentioned person in the roast.

// Usage:

//   roast (while replying to someone)  -> tags replied user

//   roast @user                        -> tags mentioned user

//   roast                              -> roasts the sender (tags sender)

const API_URL = "https://eliteprotech-apis.zone.id/insult";

function getTargetJid(ctx) {

  const m = ctx?.m;

  // reply target

  const replied =

    m?.message?.extendedTextMessage?.contextInfo?.participant ||

    m?.message?.conversation?.contextInfo?.participant ||

    null;

  if (replied) return replied;

  // mentioned target

  const mentioned =

    m?.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||

    m?.message?.conversation?.contextInfo?.mentionedJid?.[0] ||

    null;

  if (mentioned) return mentioned;

  // default: roast the sender (still tags someone)

  return ctx?.senderJid || ctx?.sender || null;

}

async function fetchInsult() {

  const res = await fetch(API_URL, {

    method: "GET",

    headers: { accept: "application/json" },

  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();

  if (!data || data.success !== true || typeof data.insult !== "string") {

    throw new Error("Bad API response");

  }

  return data.insult.trim();

}

export default {

  name: "roast",

  aliases: ["insult"],

  category: "FUN",

  description: "Roast someone (for fun). Reply to or mention them to tag.",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    try {

      const insult = await fetchInsult();

      const targetJid = getTargetJid(ctx);

      if (!targetJid) {

        return sock.sendMessage(from, { text: `🔥 BMEDIA Roast :\n\n${insult}` }, { quoted: m });

      }

      const tag = `@${String(targetJid).split("@")[0]}`;

      const text = `${tag}\n\n${insult}`;

      return sock.sendMessage(

        from,

        { text, mentions: [targetJid] },

        { quoted: m }

      );

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ Roast API error: ${e?.message || "Unknown error"}` },

        { quoted: m }

      );

    }

  },

};