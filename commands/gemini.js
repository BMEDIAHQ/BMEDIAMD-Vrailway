// commands/gemini.js (ESM)

// Uses ElitePro Gemini endpoint to generate a reply.

// Usage: !gemini <message>

// Reply: sends only the "text" field from API response.

async function safeFetch(url, opts) {

  if (globalThis.fetch) return fetch(url, opts);

  const mod = await import("node-fetch"); // fallback if Node lacks fetch

  return mod.default(url, opts);

}

export default {

  name: "gemini",

  aliases: ["gmn"],

  category: "AI",

  description: "Chat with ElitePro Gemini API.",

  async execute(ctx) {

    const { sock, m, from, args, prefix } = ctx;

    const prompt = (args || []).join(" ").trim();

    if (!prompt) {

      return sock.sendMessage(

        from,

        { text: `Usage: ${prefix}gemini <your message>` },

        { quoted: m }

      );

    }

    // ✅ Gemini endpoint from your screenshot

    const endpoint = "https://eliteprotech-apis.zone.id/gemini";

    const url = `${endpoint}?prompt=${encodeURIComponent(prompt)}`;

    try {

      try { await sock.sendPresenceUpdate?.("composing", from); } catch {}

      const res = await safeFetch(url, {

        method: "GET",

        headers: { accept: "application/json" },

      });

      if (!res.ok) {

        return sock.sendMessage(

          from,

          { text: `❌ API error (${res.status}). Try again.` },

          { quoted: m }

        );

      }

      const data = await res.json().catch(() => null);

      const text = data?.text ? String(data.text).trim() : "";

      if (!text) {

        return sock.sendMessage(

          from,

          { text: "❌ API returned no text. Try again." },

          { quoted: m }

        );

      }

      // If API returns escaped \n, keep them as actual new lines

      const cleaned = text.replace(/\\n/g, "\n").replace(/\\"/g, '"');

      return sock.sendMessage(from, { text:`*GEMINI:*\n\n ${cleaned} \n\n> BMEDIA-MD`}, { quoted: m });

    } catch (e) {

      return sock.sendMessage(

        from,

        { text: `❌ Failed: ${e?.message || e}` },

        { quoted: m }

      );

    } finally {

      try { await sock.sendPresenceUpdate?.("paused", from); } catch {}

    }

  },

};