// commands/riddle.js (ESM)

// Usage: <prefix>riddle

// Sends only the riddle and tags the sender.

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender;

}

function tagOf(jid) {

  return `@${String(jid || "").split("@")[0].split(":")[0]}`;

}

export default {

  name: "riddle",

  aliases: ["rid"],

  category: "FUN",

  description: "Get a random riddle (no answer).",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    const sender = getSender(m);

    if (!sender) return;

    try {

      const res = await fetch("https://riddles-api.vercel.app/random", {

        method: "GET",

        headers: { accept: "application/json" },

      });

      if (!res.ok) {

        return sock.sendMessage(

          from,

          { text: `❌ Riddle error: API returned HTTP ${res.status}` },

          { quoted: m }

        );

      }

      const data = await res.json().catch(() => null);

      const riddle = String(data?.riddle || "").trim();

      if (!riddle) {

        return sock.sendMessage(from, { text: "❌ Riddle error: Empty riddle." }, { quoted: m });

      }

      const tag = tagOf(sender);

      return sock.sendMessage(

        from,

        {

          text: `*RIDDLE:*\n\n${tag} ${riddle}`,

          mentions: [sender],

        },

        { quoted: m }

      );

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ Riddle error: ${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};