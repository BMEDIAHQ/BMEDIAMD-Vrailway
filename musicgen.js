// commands/musicgen.js (ESM)

// Usage: !musicgen <prompt>

// Calls ElitePro musicgen API and sends generated MP3(s) with caption.

//

// API example:

// https://eliteprotech-apis.zone.id/musicgen?prompt=Hello%20people

// Returns JSON: { results: [{ audio, cover, fileName, caption, id }, ...] }

async function safeFetch(url, opts) {

  if (globalThis.fetch) return fetch(url, opts);

  const mod = await import("node-fetch"); // fallback for older Node

  return mod.default(url, opts);

}

export default {

  name: "musicgen",

  aliases: ["music", "audiogen", "songgen"],

  category: "AI",

  description: "Generate AI music (MP3) from a prompt.",

  async execute(ctx) {

    const { sock, m, from, args, prefix } = ctx;

    const prompt = (args || []).join(" ").trim();

    if (!prompt) {

      return sock.sendMessage(

        from,

        { text: `Usage: ${prefix}musicgen <prompt>\nExample: ${prefix}musicgen Hello people` },

        { quoted: m }

      );

    }

    const endpoint = "https://eliteprotech-apis.zone.id/musicgen";

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

      const results = Array.isArray(data?.results) ? data.results : [];

      if (!results.length) {

        return sock.sendMessage(

          from,

          { text: "❌ No results returned by the API. Try a different prompt." },

          { quoted: m }

        );

      }

      // send up to 2 tracks by default (your sample returns 2)

      const toSend = results.slice(0, 2);

      for (const item of toSend) {

        const audioUrl = item?.audio ? String(item.audio) : "";

        if (!audioUrl) continue;

        const caption = item?.caption ? String(item.caption) : `🎶 AI Song\nPrompt: ${prompt}`;

        const fileName = item?.fileName ? String(item.fileName) : "music.mp3";

        // WhatsApp audio: send as document so filename is kept (mp3)

        await sock.sendMessage(

          from,

          {

            document: { url: audioUrl },

            mimetype: "audio/mpeg",

            fileName,

            caption, // useful info shown with the file

          },

          { quoted: m }

        );

      }

      // Optional: quick summary message (comment out if you don't want extra text)

      // await sock.sendMessage(from, { text: `✅ Sent ${toSend.length} track(s).` }, { quoted: m });

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