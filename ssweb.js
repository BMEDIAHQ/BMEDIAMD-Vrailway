// commands/ssweb.js (ESM)

// Usage: ssweb https://example.com

// Sends screenshot as IMAGE (not document)

export default {

  name: "ssweb",

  aliases: ["screenshot", "webshot", "ss"],

  category: "TOOLS",

  description: "Take a screenshot of a website URL and send it as an image.",

  async execute(ctx) {

    const { sock, m, from, args } = ctx;

    const rawUrl = (args && args.length) ? args.join(" ").trim() : "";

    if (!rawUrl) {

      return sock.sendMessage(

        from,

        { text: "Usage:\nssweb https://example.com" },

        { quoted: m }

      );

    }

    // Basic validation (avoid breaking the endpoint)

    const url = rawUrl.replace(/^<|>$/g, "").trim();

    if (!/^https?:\/\//i.test(url)) {

      return sock.sendMessage(

        from,

        { text: "❌ URL must start with http:// or https://\nExample: ssweb https://google.com" },

        { quoted: m }

      );

    }

    const endpoint = `https://eliteprotech-apis.zone.id/ssweb?url=${encodeURIComponent(url)}`;

    try {

      // Optional: quick "working" reaction

      await sock.sendMessage(from, { react: { text: "📸", key: m.key } }).catch(() => {});

      // Fetch image bytes from API

      const res = await fetch(endpoint, {

        method: "GET",

        headers: { "Accept": "image/*" },

      });

      if (!res.ok) {

        const errText = await res.text().catch(() => "");

        throw new Error(`API error ${res.status}: ${errText || res.statusText}`);

      }

      const arrayBuf = await res.arrayBuffer();

      const buffer = Buffer.from(arrayBuf);

      // Send as normal image

      await sock.sendMessage(

        from,

        {

          image: buffer,

          caption: `🖼️ Screenshot\n${url}`,

        },

        { quoted: m }

      );

      // Optional: remove reaction / success reaction

      await sock.sendMessage(from, { react: { text: "✅", key: m.key } }).catch(() => {});

    } catch (e) {

      await sock.sendMessage(

        from,

        { text: `❌ Screenshot failed.\nReason: ${e?.message || "unknown error"}` },

        { quoted: m }

      ).catch(() => {});

    }

  },

};