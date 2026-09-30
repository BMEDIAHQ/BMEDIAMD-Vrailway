// commands/joke.js (ESM)

// Usage: <prefix>joke

// Sends a random joke + punchline and tags the sender.

function getSender(m) {

  return m?.key?.participant || m?.participant || m?.sender;

}

function tagOf(jid) {

  return `@${String(jid || "").split("@")[0].split(":")[0]}`;

}

export default {

  name: "joke",

  aliases: ["funny", "jokes"],

  category: "FUN",

  description: "Get a random joke + punchline.",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    const sender = getSender(m);

    if (!sender) return;

    try {

      const res = await fetch("https://official-joke-api.appspot.com/random_joke", {

        method: "GET",

        headers: { accept: "application/json" },

      });

      if (!res.ok) {

        return sock.sendMessage(

          from,

          { text: `❌ Joke error: API returned HTTP ${res.status}` },

          { quoted: m }

        );

      }

      const data = await res.json().catch(() => null);

      const setup = String(data?.setup || "").trim();

      const punchline = String(data?.punchline || "").trim();

      if (!setup || !punchline) {

        return sock.sendMessage(

          from,

          { text: "❌ Joke error: Invalid response from API." },

          { quoted: m }

        );

      }

      const tag = tagOf(sender);

      return sock.sendMessage(

        from,

        {

          text: `*JOKE:*\n${tag} ${setup}\n\n*PUNCHLINE :*\n${punchline}`,

          mentions: [sender],

        },

        { quoted: m }

      );

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ Joke error: ${e?.message || e}` },

        { quoted: m }

      );

    }

  },

};