// commands/ChatGPT.js (ESM)

export default {

  name: "ChatGPT",

  aliases: ["chatgpt", "gpt"],

  category: "AI",

  description: "Ask the EliteProTech ChatGPT API and return the raw response.",

  async execute(ctx) {

    const { sock, m, from, args } = ctx;

    const prompt = (args || []).join(" ").trim();

    if (!prompt) {

      return sock.sendMessage(from, { text: "Usage: ChatGPT <your prompt>" }, { quoted: m });

    }

    try {

      const url =

        "https://eliteprotech-apis.zone.id/chatgpt?prompt=" +

        encodeURIComponent(prompt);

      const res = await fetch(url, { method: "GET" });

      const data = await res.json().catch(() => null);

      // If API format changes or error happens

      if (!res.ok || !data) {

        return sock.sendMessage(

          from,

          { text: "❌ API error. Try again later." },

          { quoted: m }

        );

      }

      // ✅ Send the response exactly as the API returns it (raw string)

      // API example: { success:true, prompt:"Hi", model:"chatgpt3", response:"Hello!" }

      const reply = `*ChatGPT* :\n\n ${typeof data.response === "string" ? data.response : JSON.stringify(data, null, 2)}`;

      return sock.sendMessage(from, { text: reply }, { quoted: m });

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: "❌ Failed to reach API. Check your connection/server." },

        { quoted: m }

      );

    }

  },

};