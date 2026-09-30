// commands/shortenurl.js (ESM)

export default {

  name: "shortenurl",

  aliases: ["tinyurl", "surl"],

  category: "UTILITY",

  description: "Shorten a link using your Cloudflare TinyURL Worker.",

  async execute(ctx) {

    const { sock, m, from, args } = ctx;

    try {

      const input = (args || []).join(" ").trim();

      if (!input) {

        return sock.sendMessage(

          from,

          { text: `Usage:\nshortenurl https://google.com` },

          { quoted: m }

        );

      }

      // Normalize scheme if user sends "google.com"

      const longUrl = /^https?:\/\//i.test(input) ? input : `https://${input}`;

      // Validate URL

      try {

        new URL(longUrl);

      } catch {

        return sock.sendMessage(

          from,

          { text: "❌ Invalid URL.\nExample: shortenurl https://google.com" },

          { quoted: m }

        );

      }

      const endpoint =

        "https://bmedia-tinyurl.bmediabotline.workers.dev/short?url=" +

        encodeURIComponent(longUrl);

      const res = await fetch(endpoint, {

        method: "GET",

        headers: { accept: "application/json" },

      });

      if (!res.ok) {

        const t = await res.text().catch(() => "");

        return sock.sendMessage(

          from,

          {

            text:

              `❌ Shorten failed (${res.status}).` +

              (t ? `\n\n${t.slice(0, 500)}` : ""),

          },

          { quoted: m }

        );

      }

      const data = await res.json().catch(() => null);

      const original = data?.original || longUrl;

      const short = data?.short;

      if (!short) {

        return sock.sendMessage(

          from,

          { text: "❌ API returned no shortened link." },

          { quoted: m }

        );

      }

      const msg =

        `🔗 *URL Shortened*\n\n` +

        `• *Original:* ${original}\n` +

        `• *Short:* ${short}`;

      await sock.sendMessage(from, { text: msg }, { quoted: m }).catch(() => {});

      // optional reaction (safe)

      await sock.sendMessage(from, { react: { text: "✅", key: m.key } }).catch(() => {});

    } catch (err) {

      await sock

        .sendMessage(from, { text: `❌ Error: ${err?.message || String(err)}` }, { quoted: m })

        .catch(() => {});

    }

  },

};