// commands/meme.js (ESM)

// Random meme

// Usage: <prefix>meme

export default {

  name: "meme",

  aliases: ["memes"],

  category: "FUN",

  description: "Get a random meme.",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    try {

      const res = await fetch("https://meme-api.com/gimme", { method: "GET" });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      const url = data?.url;

      const title = data?.title || "Meme";

      if (!url) throw new Error("No meme URL returned.");

      // send as image by URL

      return sock.sendMessage(

        from,

        { image: { url }, caption: `😂 ${title}` },

        { quoted: m }

      );

    } catch (e) {

      return sock.sendMessage(from, { text: `❌ Meme error: ${e?.message || e}` }, { quoted: m });

    }

  },

};