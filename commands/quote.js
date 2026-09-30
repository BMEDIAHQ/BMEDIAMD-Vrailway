// commands/quote.js (ESM)

// Random quote (online API)

// Usage: <prefix>quote

export default {

  name: "quote",

  aliases: ["quotes"],

  category: "FUN",

  description: "Get a random quote.",

  async execute(ctx) {

    const { sock, m, from } = ctx;

    try {

      const res = await fetch("https://api.quotable.io/random", { method: "GET" });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      const text = `📝 "${data?.content || "..." }"\n— ${data?.author || "Unknown"}`;

      return sock.sendMessage(from, { text }, { quoted: m });

    } catch (e) {

      return sock.sendMessage(from, { text: `❌ Quote error: ${e?.message || e}` }, { quoted: m });

    }

  },

};