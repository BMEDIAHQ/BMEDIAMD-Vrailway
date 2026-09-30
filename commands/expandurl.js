// commands/expandurl.js (ESM)

export default {

  name: "expandurl",

  aliases: ["expand", "unshort", "longurl"],

  category: "UTILITY",

  description: "Expand a shortened URL by following redirects to the final destination.",

  async execute(ctx) {

    const { sock, m, from, args } = ctx;

    const raw = (args || []).join(" ").trim();

    if (!raw) {

      return sock.sendMessage(

        from,

        { text: `Usage:\nexpandurl https://tinyurl.com/xxxx` },

        { quoted: m }

      );

    }

    // Normalize scheme if user sends "tinyurl.com/xxxx"

    const inputUrl = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

    // Validate URL

    let startUrl;

    try {

      startUrl = new URL(inputUrl).toString();

    } catch {

      return sock.sendMessage(

        from,

        { text: "❌ Invalid URL.\nExample: expandurl https://tinyurl.com/xxxx" },

        { quoted: m }

      );

    }

    const MAX_HOPS = 10;

    const TIMEOUT_MS = 15000;

    const hopChain = [];

    const visited = new Set();

    const fetchOnce = async (url, method) => {

      const controller = new AbortController();

      const t = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {

        // redirect: "manual" so we can capture Location ourselves

        const res = await fetch(url, {

          method,

          redirect: "manual",

          signal: controller.signal,

          headers: {

            "user-agent": "BMEDIA-MD/expandurl",

            "accept": "*/*",

          },

        });

        return res;

      } finally {

        clearTimeout(t);

      }

    };

    const resolveLocation = (currentUrl, location) => {

      try {

        // handles relative redirects too

        return new URL(location, currentUrl).toString();

      } catch {

        return null;

      }

    };

    let current = startUrl;

    hopChain.push(current);

    try {

      for (let hop = 0; hop < MAX_HOPS; hop++) {

        if (visited.has(current)) break;

        visited.add(current);

        // Try HEAD first (faster); some servers don't support it -> fallback to GET

        let res = await fetchOnce(current, "HEAD").catch(() => null);

        if (!res || (res.status >= 400 && res.status !== 405 && res.status !== 403)) {

          // fallback GET if HEAD fails or is blocked

          res = await fetchOnce(current, "GET");

        } else if (res.status === 405 || res.status === 403) {

          res = await fetchOnce(current, "GET");

        }

        // 3xx redirect

        if (res.status >= 300 && res.status < 400) {

          const loc = res.headers.get("location");

          if (!loc) break;

          const next = resolveLocation(current, loc);

          if (!next) break;

          current = next;

          hopChain.push(current);

          continue;

        }

        // Not a redirect => final

        break;

      }

      const original = startUrl;

      const finalUrl = hopChain[hopChain.length - 1] || startUrl;

      const hops = Math.max(0, hopChain.length - 1);

      const chainText =

        hopChain.length > 1

          ? hopChain.map((u, i) => `${i + 1}. ${u}`).join("\n")

          : "No redirects detected.";

      const msg =

        `🔎 *URL Expanded*\n\n` +

        `• *Original:* ${original}\n` +

        `• *Final:* ${finalUrl}\n` +

        `• *Redirects:* ${hops}\n\n` +

        `*Chain:*\n${chainText}`;

      await sock.sendMessage(from, { text: msg }, { quoted: m }).catch(() => {});

      await sock.sendMessage(from, { react: { text: "✅", key: m.key } }).catch(() => {});

    } catch (err) {

      await sock

        .sendMessage(from, { text: `❌ Error: ${err?.message || String(err)}` }, { quoted: m })

        .catch(() => {});

    }

  },

};