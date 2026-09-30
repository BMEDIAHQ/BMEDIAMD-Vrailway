// commands/firelogo.js (ESM)

// Endpoint: https://eliteprotech-apis.zone.id/firelogo?text=...

// Usage: !firelogo <text>

// Sends the generated fire logo image.

async function safeFetch(url, opts) {

  if (globalThis.fetch) return fetch(url, opts);

  const mod = await import("node-fetch");

  return mod.default(url, opts);

}

export default {

  name: "firelogo",

  aliases: ["firetext", "flogo"],

  category: "LOGO",

  description: "Generate a fire logo image from text.",

  async execute(ctx) {

    const { sock, m, from, args, prefix } = ctx;

    const text = (args || []).join(" ").trim();

    if (!text) {

      return sock.sendMessage(

        from,

        { text: `Usage: ${prefix}firelogo <text>\nExample: ${prefix}firelogo Bmedia` },

        { quoted: m }

      );

    }

    const apiUrl = `https://eliteprotech-apis.zone.id/firelogo?text=${encodeURIComponent(text)}`;

    try {

      try { await sock.sendPresenceUpdate?.("composing", from); } catch {}

      const res = await safeFetch(apiUrl, { method: "GET", headers: { accept: "application/json" } });

      if (!res.ok) throw new Error(`API error: HTTP ${res.status}`);

      const data = await res.json().catch(() => null);

      if (!data || data.success !== true) {

        throw new Error(data?.message || "Invalid API response");

      }

      const imgUrl = data.image;

      if (!imgUrl || typeof imgUrl !== "string" || !imgUrl.startsWith("http")) {

        throw new Error("No image URL returned by API");

      }

      return sock.sendMessage(

        from,

        {

          image: { url: imgUrl },

          caption: `🔥 *Firelogo*\nText: ${data.text || text}`,

        },

        { quoted: m }

      );

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